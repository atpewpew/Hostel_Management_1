import z from "zod";
import LostFound from "../models/lostFound.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { uploadBufferToCloudinary, getSecureUrl } from "../config/cloudinary.js";
import { logger } from "../middleware/logger.js";
import { invalidateCacheByPrefix } from "../middleware/cache.middleware.js";

const createItemSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title cannot exceed 120 characters")
    .refine((v) => v.trim().length > 0, "Title cannot be blank"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description cannot exceed 2000 characters"),
  type: z.enum(["LOST", "FOUND"]),
  category: z.enum([
    "Keys",
    "Electronics",
    "Documents/ID",
    "Wallets/Bags",
    "Clothing",
    "Books/Stationery",
    "Accessories",
    "Other",
  ]),
  location: z.string().min(2, "Location is required"),
  date: z.string().optional(),
  hostelId: z.string().optional().nullable(),
  verificationQuestion: z.string().max(300).optional().nullable(),
  allowEmail: z.union([z.boolean(), z.string()]).optional(),
  allowPhone: z.union([z.boolean(), z.string()]).optional(),
  phoneNumber: z.string().optional().nullable(),
  pickupLocation: z.string().optional().nullable(),
});

const submitClaimSchema = z.object({
  proofDescription: z
    .string()
    .min(5, "Proof/description must be at least 5 characters")
    .max(1000, "Proof cannot exceed 1000 characters"),
  contactNumber: z.string().optional().nullable(),
});

export async function getLostFoundItems(req, res) {
  try {
    const collegeId = req.user.collegeId;
    const {
      type,
      category,
      status,
      hostelId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { collegeId };

    if (type && ["LOST", "FOUND"].includes(type.toUpperCase())) {
      query.type = type.toUpperCase();
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status.toUpperCase();
    } else {
      query.status = { $ne: "EXPIRED" };
    }

    if (hostelId) {
      query.hostelId = hostelId;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      LostFound.find(query)
        .populate("reportedBy", "name email roomNo hostelId role")
        .populate("hostelId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      LostFound.countDocuments(query),
    ]);

    // Sanitize claims so claimants' private information is hidden from other students in the feed
    const sanitizedItems = items.map((item) => {
      const isOwner =
        req.user &&
        (item.reportedBy?._id?.toString() === req.user._id.toString() ||
          ["warden", "collegeAdmin", "manager"].includes(req.user.role));

      const myClaim = item.claims?.find(
        (c) => c.claimantId?.toString() === req.user._id.toString()
      );

      return {
        ...item,
        claimCount: item.claims ? item.claims.length : 0,
        claims: isOwner ? item.claims : myClaim ? [myClaim] : [],
        hasUserClaimed: Boolean(myClaim),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Lost & Found items retrieved successfully",
      data: sanitizedItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error("Error retrieving Lost & Found items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Lost & Found items",
      error: error.message,
    });
  }
}

export async function getMyLostFoundItems(req, res) {
  try {
    const items = await LostFound.find({
      reportedBy: req.user._id,
      collegeId: req.user.collegeId,
    })
      .populate("hostelId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "My Lost & Found items retrieved successfully",
      data: items,
    });
  } catch (error) {
    logger.error("Error fetching user's Lost & Found items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user's Lost & Found items",
      error: error.message,
    });
  }
}

export async function getLostFoundItemById(req, res) {
  try {
    const { id } = req.params;
    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    })
      .populate("reportedBy", "name email roomNo hostelId role")
      .populate("hostelId", "name")
      .lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or belongs to another college",
      });
    }

    const isOwner =
      item.reportedBy?._id?.toString() === req.user._id.toString() ||
      ["warden", "collegeAdmin", "manager"].includes(req.user.role);

    const myClaim = item.claims?.find(
      (c) => c.claimantId?.toString() === req.user._id.toString()
    );

    const sanitized = {
      ...item,
      claimCount: item.claims?.length || 0,
      claims: isOwner ? item.claims : myClaim ? [myClaim] : [],
      hasUserClaimed: Boolean(myClaim),
    };

    return res.status(200).json({
      success: true,
      message: "Item details retrieved successfully",
      data: sanitized,
    });
  } catch (error) {
    logger.error("Error fetching Lost & Found item details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch item details",
      error: error.message,
    });
  }
}

export async function createLostFoundItem(req, res) {
  try {
    const validationResult = createItemSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const {
      title,
      description,
      type,
      category,
      location,
      date,
      hostelId,
      verificationQuestion,
      allowEmail,
      allowPhone,
      phoneNumber,
      pickupLocation,
    } = validationResult.data;

    let itemImage = null;
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "lost-found",
      });
      itemImage = getSecureUrl(uploadResult);
    }

    const parseBool = (val, defaultVal = false) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() === "true";
      return defaultVal;
    };

    const newItem = new LostFound({
      title: title.trim(),
      description: description.trim(),
      type,
      category,
      location: location.trim(),
      date: date ? new Date(date) : new Date(),
      collegeId: req.user.collegeId,
      hostelId: hostelId || req.user.hostelId || null,
      reportedBy: req.user._id,
      itemImage,
      verificationQuestion: verificationQuestion?.trim() || null,
      contactPreferences: {
        allowEmail: parseBool(allowEmail, true),
        allowPhone: parseBool(allowPhone, false),
        phoneNumber: phoneNumber?.trim() || null,
        pickupLocation: pickupLocation?.trim() || null,
      },
      status: "OPEN",
    });

    await newItem.save();
    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    logger.info(`Lost & Found item created (${type}): ${newItem._id} by user ${req.user._id}`);

    const populated = await LostFound.findById(newItem._id)
      .populate("reportedBy", "name email roomNo role")
      .populate("hostelId", "name");

    return res.status(201).json({
      success: true,
      message: `${type === "LOST" ? "Lost item report" : "Found item post"} created successfully`,
      data: populated,
    });
  } catch (error) {
    logger.error("Error creating Lost & Found item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create item post",
      error: error.message,
    });
  }
}

export async function updateLostFoundItem(req, res) {
  try {
    const { id } = req.params;
    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const isAuthorized =
      item.reportedBy.toString() === req.user._id.toString() ||
      ["warden", "collegeAdmin", "manager"].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this item",
      });
    }

    const {
      title,
      description,
      category,
      location,
      verificationQuestion,
      pickupLocation,
      phoneNumber,
      allowPhone,
      allowEmail,
    } = req.body;

    if (title) item.title = title.trim();
    if (description) item.description = description.trim();
    if (category) item.category = category;
    if (location) item.location = location.trim();
    if (verificationQuestion !== undefined) {
      item.verificationQuestion = verificationQuestion?.trim() || null;
    }

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "lost-found",
      });
      item.itemImage = getSecureUrl(uploadResult);
    }

    if (pickupLocation !== undefined) {
      item.contactPreferences.pickupLocation = pickupLocation?.trim() || null;
    }
    if (phoneNumber !== undefined) {
      item.contactPreferences.phoneNumber = phoneNumber?.trim() || null;
    }
    if (allowPhone !== undefined) {
      item.contactPreferences.allowPhone = String(allowPhone) === "true";
    }
    if (allowEmail !== undefined) {
      item.contactPreferences.allowEmail = String(allowEmail) === "true";
    }

    await item.save();
    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error) {
    logger.error("Error updating Lost & Found item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update item",
      error: error.message,
    });
  }
}

export async function updateItemStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["OPEN", "CLAIMED", "RESOLVED", "EXPIRED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const isAuthorized =
      item.reportedBy.toString() === req.user._id.toString() ||
      ["warden", "collegeAdmin", "manager"].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change this item status",
      });
    }

    item.status = status;
    if (status === "CLAIMED" || status === "RESOLVED") {
      item.resolvedAt = new Date();
    } else if (status === "OPEN") {
      item.resolvedAt = null;
    }

    await item.save();
    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    return res.status(200).json({
      success: true,
      message: `Item status updated to ${status}`,
      data: item,
    });
  } catch (error) {
    logger.error("Error updating item status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
}

export async function submitClaim(req, res) {
  try {
    const { id } = req.params;
    const validationResult = submitClaimSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (item.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Cannot claim an item with status: ${item.status}`,
      });
    }

    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot claim your own posted item",
      });
    }

    const existingClaim = item.claims.find(
      (c) =>
        c.claimantId.toString() === req.user._id.toString() &&
        c.status === "PENDING"
    );

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending claim for this item",
      });
    }

    const user = await User.findById(req.user._id).populate("hostelId", "name");

    const newClaim = {
      claimantId: req.user._id,
      claimantName: user.name,
      claimantEmail: user.email,
      claimantRoom: user.roomNo || null,
      claimantHostel: user.hostelId?.name || null,
      proofDescription: validationResult.data.proofDescription.trim(),
      contactNumber: validationResult.data.contactNumber?.trim() || null,
      status: "PENDING",
      createdAt: new Date(),
    };

    item.claims.push(newClaim);
    await item.save();

    // Trigger in-app notification to the item poster
    try {
      await Notification.create({
        userId: item.reportedBy,
        collegeId: item.collegeId,
        type: "problem_status_updated", // Reusing existing notification type for compatibility
        title: "New Claim Received",
        message: `${user.name} submitted a claim proof for your item "${item.title}".`,
        relatedEntityId: item._id,
        relatedEntityType: "problem",
      });
    } catch (notifErr) {
      logger.warn("Could not save claim notification:", notifErr.message);
    }

    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    return res.status(201).json({
      success: true,
      message: "Claim submitted successfully. The finder has been notified.",
      data: item.claims[item.claims.length - 1],
    });
  } catch (error) {
    logger.error("Error submitting claim:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit claim",
      error: error.message,
    });
  }
}

export async function respondToClaim(req, res) {
  try {
    const { id, claimId } = req.params;
    const { action } = req.body; // "ACCEPT" or "REJECT"

    if (!["ACCEPT", "REJECT"].includes(action?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Action must be ACCEPT or REJECT",
      });
    }

    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const isAuthorized =
      item.reportedBy.toString() === req.user._id.toString() ||
      ["warden", "collegeAdmin", "manager"].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to respond to claims for this item",
      });
    }

    const claim = item.claims.id(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    if (action.toUpperCase() === "ACCEPT") {
      claim.status = "ACCEPTED";
      item.status = "CLAIMED";
      item.resolvedAt = new Date();

      // Reject all other pending claims
      item.claims.forEach((c) => {
        if (c._id.toString() !== claimId && c.status === "PENDING") {
          c.status = "REJECTED";
        }
      });
    } else {
      claim.status = "REJECTED";
    }

    await item.save();

    // Notify claimant
    try {
      await Notification.create({
        userId: claim.claimantId,
        collegeId: item.collegeId,
        type: "problem_status_updated",
        title: action.toUpperCase() === "ACCEPT" ? "Claim Accepted!" : "Claim Update",
        message:
          action.toUpperCase() === "ACCEPT"
            ? `Your claim for "${item.title}" was accepted! Check contact details to coordinate handover.`
            : `Your claim for "${item.title}" was not approved by the reporter.`,
        relatedEntityId: item._id,
        relatedEntityType: "problem",
      });
    } catch (notifErr) {
      logger.warn("Could not save claim response notification:", notifErr.message);
    }

    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    return res.status(200).json({
      success: true,
      message: `Claim ${action.toLowerCase()}ed successfully`,
      data: item,
    });
  } catch (error) {
    logger.error("Error responding to claim:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to respond to claim",
      error: error.message,
    });
  }
}

export async function deleteLostFoundItem(req, res) {
  try {
    const { id } = req.params;
    const item = await LostFound.findOne({
      _id: id,
      collegeId: req.user.collegeId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const isAuthorized =
      item.reportedBy.toString() === req.user._id.toString() ||
      ["warden", "collegeAdmin", "manager"].includes(req.user.role);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this item",
      });
    }

    await LostFound.findByIdAndDelete(id);
    await invalidateCacheByPrefix(`cache:lostfound:${req.user.collegeId}:`);

    return res.status(200).json({
      success: true,
      message: "Lost & Found item deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting Lost & Found item:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete item",
      error: error.message,
    });
  }
}

