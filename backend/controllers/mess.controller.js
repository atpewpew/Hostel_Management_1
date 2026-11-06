import Feedback from "../models/feedback.model.js";
import { z } from 'zod';
import Mess from '../models/mess.model.js';
import User from '../models/user.model.js';
import Menu from "../models/menu.model.js";
import { authorizeRoles } from '../middleware/roles.js';
import { logger } from '../middleware/logger.js';
import { notifyUsers } from '../utils/notificationService.js';
import { invalidateCacheByPrefix } from "../middleware/cache.middleware.js";

const days = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
const mealTypes = [ "Breakfast", "Lunch", "Snacks", "Dinner" ];

const buildMenuResponse = (menuDocs) => {
    const menu = {};

    menuDocs.forEach((doc) => {
        menu[ doc.day ] = doc.meals;
    });

    return menu;
};

const submitFeedbackSchema = z.object({
    date: z.coerce.date(),
    mealType: z.enum(mealTypes),
    rating: z.coerce.number().min(1).max(5),
    comment: z.string().trim().optional().default(""),
});

const menuItemsSchema = z.array(
    z.string()
        .trim()
        .min(1, "Menu entries cannot be empty")
).min(1, "At least one menu item is required");

const dayMenuSchema = z.object({
    Breakfast: menuItemsSchema.optional(),
    Lunch: menuItemsSchema.optional(),
    Snacks: menuItemsSchema.optional(),
    Dinner: menuItemsSchema.optional(),
}).refine(
    (meals) => Object.values(meals).some((items) => Array.isArray(items) && items.length > 0),
    { message: "Provide at least one meal entry per day" }
);

// Build a partial object schema for updates – each day key is optional
// so the client can send any subset of days.
const daysObject = Object.fromEntries(days.map((d) => [ d, dayMenuSchema.optional() ]));
const updateMenuSchema = z.object({
    updates: z.object(daysObject).refine(
        (updates) => Object.values(updates).some((v) => v !== undefined),
        { message: "At least one day update is required" }
    ),
});

export const getMenu = async (req, res) => {
    try {
        const collegeId = req.user.collegeId;
        const { messId } = req.query;

        if (!messId) {
            return res.status(400).json({
                success: false,
                message: "messId query parameter is required",
            });
        }

        // Verify mess belongs to user's college
        const mess = await Mess.findOne({ _id: messId, collegeId });
        if (!mess) {
            return res.status(404).json({
                success: false,
                message: "Mess not found in your college",
            });
        }

        const menuDocs = await Menu.find({ messId, collegeId }).lean();
        const menu = buildMenuResponse(menuDocs);

        return res.status(200).json({
            success: true,
            message: "Menu fetched successfully",
            menu,
        });
    } catch (error) {
        logger.error("Failed to load menu:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load menu",
        });
    }
}

export const updateMenu = async (req, res) => {
    try {
        const { messId, updates: rawUpdates } = req.body || {};

        if (!messId) {
            return res.status(400).json({
                success: false,
                message: "messId is required",
            });
        }

        // Verify mess belongs to user's college
        const mess = await Mess.findOne({ _id: messId, collegeId: req.user.collegeId });
        if (!mess) {
            return res.status(404).json({
                success: false,
                message: "Mess not found in your college",
            });
        }

        const validationResult = updateMenuSchema.safeParse({ updates: rawUpdates });

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: z.treeifyError(validationResult.error),
            });
        }

        const { updates } = validationResult.data;

        const bulkOps = [];
        const updatedEntries = [];

        Object.entries(updates).forEach(([ day, meals ]) => {
            const setOperations = {};

            Object.entries(meals).forEach(([ mealType, items ]) => {
                if (!items || !items.length) {
                    return;
                }

                const sanitizedItems = items.map((item) => item.trim()).filter(Boolean);

                if (!sanitizedItems.length) {
                    return;
                }

                setOperations[ `meals.${mealType}` ] = sanitizedItems;
                updatedEntries.push(`${day} ${mealType}`);
            });

            if (Object.keys(setOperations).length > 0) {
                bulkOps.push({
                    updateOne: {
                        filter: { day, messId, collegeId: req.user.collegeId },
                        update: {
                            $set: {
                                day,
                                messId,
                                collegeId: req.user.collegeId,
                                ...setOperations,
                            },
                        },
                        upsert: true,
                    },
                });
            }
        });

        if (!bulkOps.length) {
            return res.status(400).json({
                success: false,
                message: "No valid menu updates provided",
            });
        }

        // Execute bulk write
        const bulkResult = await Menu.bulkWrite(bulkOps);

        logger.info("Menu updated", {
            updatesCount: updatedEntries.length,
            updatedEntries: updatedEntries.join(", "),
            updatedBy: req.user._id,
            matchedCount: bulkResult.matchedCount,
            modifiedCount: bulkResult.modifiedCount,
            upsertedCount: bulkResult.upsertedCount,
        });
        await invalidateCacheByPrefix(`cache:mess:menu:${req.user.collegeId.toString()}:`);

        // Send notification to all students about the batch update
        try {
            const students = await User.find({ role: 'student', collegeId: req.user.collegeId }).select('_id hostelId');
            const studentIds = students.map((student) => student._id.toString());
            if (studentIds.length > 0) {
                const message = `${req.user.name} updated the mess menu`;

                await notifyUsers(studentIds, {
                    type: 'mess_menu_updated',
                    title: 'Mess Menu Updated',
                    message,
                    relatedEntityId: req.user._id,
                    relatedEntityType: 'mess',
                });

                logger.info('Notifications sent for mess menu update', {
                    recipients: studentIds.length
                });
            }
        } catch (notifError) {
            logger.error('Failed to send notifications for mess menu update', {
                error: notifError.message
            });
        }

        const latestMenuDocs = await Menu.find({ messId, collegeId: req.user.collegeId }).lean();

        return res.status(200).json({
            success: true,
            message: `Menu updated successfully (${updatedEntries.length} ${updatedEntries.length === 1 ? 'entry' : 'entries'})`,
            menu: buildMenuResponse(latestMenuDocs),
            updatedCount: updatedEntries.length,
        });
    } catch (error) {
        logger.error("Failed to update menu:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update menu",
        });
    }
}

export const submitFeedback = async (req, res) => {
    try {
        const validationResult = submitFeedbackSchema.safeParse(req.body || {});

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: z.treeifyError(validationResult.error),
            });
        }

        const { date, mealType, rating, comment } = validationResult.data;

        const day = days[ date.getDay() ];
        const feedback = await Feedback.create({
            date,
            day,
            mealType,
            rating,
            comment,
            user: req.user._id,
            collegeId: req.user.collegeId,
            messId: req.user.messId || undefined,
        });

        logger.info("Feedback submitted", { userId: req.user._id, mealType, rating });

        // Notify admins and wardens about the new mess feedback
        try {
            // Find all admins in this college
            const admins = await User.find({ role: 'collegeAdmin', collegeId: req.user.collegeId }).select('_id');
            const adminIds = admins.map((admin) => admin._id.toString());

            // Find wardens for the student's hostel
            const studentHostel = req.user.hostelId;
            const wardens = await User.find({
                role: 'warden',
                hostelId: studentHostel,
                collegeId: req.user.collegeId,
            }).select('_id');
            const wardenIds = wardens.map((warden) => warden._id.toString());

            // Combine admin and warden IDs
            const notifyUserIds = [ ...adminIds, ...wardenIds ];

            if (notifyUserIds.length > 0) {
                await notifyUsers(notifyUserIds, {
                    type: 'mess_feedback_submitted',
                    title: 'New Mess Feedback',
                    message: `${req.user.name} (${req.user.hostelId}) submitted ${mealType} feedback with rating ${rating}/5`,
                    relatedEntityId: feedback._id,
                    relatedEntityType: 'mess',
                });
                logger.info('Notifications sent for mess feedback submission', {
                    feedbackId: feedback._id.toString(),
                    notifiedUsers: notifyUserIds.length,
                });
            }
        } catch (notifError) {
            // Log error but don't fail the request
            logger.error('Failed to send notifications for mess feedback submission', {
                error: notifError.message,
                feedbackId: feedback._id.toString(),
            });
        }

        return res.status(201).json({
            success: true,
            message: "Feedback submitted successfully",
            feedback,
        });
    } catch (error) {
        logger.error("Failed to submit feedback:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit feedback",
        });
    }
}

export const getAllFeedbacks = async (req, res) => {
    try {
        const feedbacks = await Feedback.find({ collegeId: req.user.collegeId })
            .populate({
                path: 'user',
                select: 'name email rollNo hostelId roomNo',
                populate: { path: 'hostelId', select: 'name' },
            })
            .sort({ createdAt: -1 });

        const feedbacksWithHostelName = feedbacks.map((f) => {
            const u = f.user;
            const plain = f.toObject ? f.toObject() : { ...f };
            plain.user = u
                ? {
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    rollNo: u.rollNo,
                    roomNo: u.roomNo,
                    hostelId: u.hostelId?._id?.toString() ?? u.hostelId?.toString(),
                    hostelName: u.hostelId?.name ?? null,
                }
                : u;
            return plain;
        });

        logger.info("Feedbacks fetched", {
            count: feedbacks.length,
            requestedBy: req.user._id,
            role: req.user.role
        });

        return res.status(200).json({
            success: true,
            message: "Feedbacks fetched successfully",
            feedbacks: feedbacksWithHostelName,
            count: feedbacks.length,
        });
    } catch (error) {
        logger.error("Failed to fetch feedbacks:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch feedbacks",
        });
    }
}

// Create a new mess (collegeAdmin only)
export const createMess = async (req, res) => {
    try {
        const { name, capacity } = req.body;
        const collegeId = req.user.collegeId;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Mess name is required",
            });
        }

        const mess = await Mess.create({
            name: name.trim(),
            capacity: capacity || 0,
            collegeId,
        });
        await invalidateCacheByPrefix(`cache:mess:list:${collegeId.toString()}:`);

        return res.status(201).json({
            success: true,
            message: "Mess created successfully",
            mess,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A mess with this name already exists in your college",
            });
        }
        logger.error("Failed to create mess:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create mess",
        });
    }
};

// Delete a mess (collegeAdmin only)
export const deleteMess = async (req, res) => {
    try {
        const { id } = req.params;
        const collegeId = req.user.collegeId;

        const mess = await Mess.findOne({ _id: id, collegeId });
        if (!mess) {
            return res.status(404).json({
                success: false,
                message: "Mess not found in your college",
            });
        }

        // Unset messId/messName for any users assigned to this mess
        await User.updateMany(
            { messId: mess._id, collegeId },
            { $unset: { messId: "", messName: "" } }
        );

        // Remove related menus and feedback
        await Promise.all([
            Menu.deleteMany({ messId: mess._id, collegeId }),
            Feedback.deleteMany({ messId: mess._id, collegeId }),
        ]);

        await Mess.findByIdAndDelete(mess._id);

        logger.info("Mess deleted", { messId: id, deletedBy: req.user._id });

        return res.status(200).json({
            success: true,
            message: "Mess deleted successfully",
        });
    } catch (error) {
        logger.error("Failed to delete mess:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete mess",
        });
    }
};

// List all messes for the user's college
export const listMesses = async (req, res) => {
    try {
        const collegeId = req.user.collegeId;
        const messes = await Mess.find({ collegeId }).sort({ name: 1 }).lean();

        return res.status(200).json({
            success: true,
            messes,
        });
    } catch (error) {
        logger.error("Failed to list messes:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to list messes",
        });
    }
};
