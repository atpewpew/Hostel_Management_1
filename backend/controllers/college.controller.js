import z from "zod";
import { logger } from "../middleware/logger.js";
import College from "../models/college.model.js";
import Hostel from "../models/hostel.model.js";
import Mess from "../models/mess.model.js";
import { uploadBufferToCloudinary, getSecureUrl } from "../config/cloudinary.js";
import { invalidateCacheByPrefix } from "../middleware/cache.middleware.js";

const registerCollegeSchema = z.object({
    collegeName: z.string().min(1, "College name is required").trim(),
    emailDomain: z
        .string()
        .min(1, "Email domain is required")
        .trim()
        .toLowerCase()
        .regex(/^@/, "Email domain must start with @"),
    adminEmail: z.string().email("Invalid admin email format").trim().toLowerCase(),
    address: z.string().optional(),
    hostels: z
        .array(z.string().min(1, "Hostel name cannot be empty").trim())
        .min(1, "At least one hostel is required"),
    messes: z
        .array(z.string().min(1, "Mess name cannot be empty").trim())
        .min(1, "At least one mess is required"),
});

/**
 * Register a new College (SaaS Onboarding)
 */
export const registerCollege = async (req, res) => {
    try {
        // Normalize FormData array fields (hostels[] -> hostels, messes[] -> messes)
        if (req.body[ 'hostels[]' ]) {
            req.body.hostels = Array.isArray(req.body[ 'hostels[]' ]) ? req.body[ 'hostels[]' ] : [ req.body[ 'hostels[]' ] ];
            delete req.body[ 'hostels[]' ];
        }
        if (req.body[ 'messes[]' ]) {
            req.body.messes = Array.isArray(req.body[ 'messes[]' ]) ? req.body[ 'messes[]' ] : [ req.body[ 'messes[]' ] ];
            delete req.body[ 'messes[]' ];
        }

        const validationResult = registerCollegeSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: z.treeifyError(validationResult.error),
            });
        }

        const {
            collegeName,
            emailDomain,
            adminEmail,
            address,
            hostels,
            messes,
        } = validationResult.data;

        // Check if college/domain already exists
        const existingCollege = await College.findOne({
            $or: [ { emailDomain }, { adminEmail } ],
        });
        if (existingCollege) {
            return res.status(400).json({
                success: false,
                message:
                    "A college with this email domain or admin email is already registered.",
            });
        }

        // Verify admin email matches the provided email domain
        if (!adminEmail.endsWith(emailDomain)) {
            return res.status(400).json({
                success: false,
                message: `Admin email (${adminEmail}) must belong to the provided college domain (${emailDomain}).`,
            });
        }

        // Upload logo to Cloudinary if provided
        let logoUrl = null;
        if (req.file) {
            try {
                const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
                    folder: "hostelia/college-logos",
                    resource_type: "image",
                });
                logoUrl = getSecureUrl(uploadResult);
            } catch (uploadError) {
                logger.error("Logo upload failed:", uploadError);
                // Non-fatal: proceed without logo
            }
        }

        // Phase 1: Create College
        const newCollege = await College.create({
            name: collegeName,
            emailDomain,
            adminEmail,
            address,
            ...(logoUrl && { logo: logoUrl }),
        });

        // Phase 2: Create Hostels
        const hostelDocs = hostels.map((hostelName) => ({
            name: hostelName,
            collegeId: newCollege._id,
        }));
        await Hostel.insertMany(hostelDocs);

        // Phase 3: Create Messes
        const messDocs = messes.map((messName) => ({
            name: messName,
            collegeId: newCollege._id,
        }));
        await Mess.insertMany(messDocs);

        logger.info("College registration submitted (pending approval)", {
            collegeId: newCollege._id,
            emailDomain,
        });
        await invalidateCacheByPrefix("cache:college:list:");

        return res.status(201).json({
            success: true,
            message:
                "College registration submitted successfully. It will be reviewed by the platform team.",
            college: {
                id: newCollege._id,
                name: newCollege.name,
                emailDomain: newCollege.emailDomain,
                status: "pending",
            },
        });
    } catch (error) {
        logger.error("Error registering college:", error);
        return res.status(500).json({
            success: false,
            message: "Error registering college",
            error: error.message,
        });
    }
};

/**
 * Get list of registered colleges
 */
export const getCollegesList = async (req, res) => {
    try {
        // Include approved AND legacy colleges (those without a status field)
        const colleges = await College.find({
            $or: [ { status: 'approved' }, { status: { $exists: false } } ]
        }).sort({ name: 1 });
        return res.status(200).json({
            success: true,
            colleges,
        });
    } catch (error) {
        logger.error("Error fetching colleges list:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching colleges",
        });
    }
};

/**
 * Get hostels for a specific college (public, for signup dropdown)
 */
export const getCollegeHostels = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const hostels = await Hostel.find({ collegeId })
            .select("_id name")
            .sort({ name: 1 });
        return res.status(200).json({
            success: true,
            hostels,
        });
    } catch (error) {
        logger.error("Error fetching college hostels:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error fetching hostels",
        });
    }
};
