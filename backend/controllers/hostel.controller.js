import { z } from 'zod';
import Hostel from '../models/hostel.model.js';
import User from '../models/user.model.js';
import { logger } from '../middleware/logger.js';
import { invalidateCacheByPrefix } from '../middleware/cache.middleware.js';

const createHostelSchema = z.object({
    name: z.string().min(1, "Name is required").trim(),
    capacity: z.number().int().positive().optional(),
});

export async function createHostel(req, res) {
    const parsed = createHostelSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: z.treeifyError(parsed.error),
        });
    }

    const { name, capacity } = parsed.data;
    const { collegeId, _id: adminId } = req.user;

    try {
        const existingHostel = await Hostel.findOne({ name, collegeId });
        if (existingHostel) {
            return res.status(400).json({
                success: false,
                message: `Hostel '${name}' already exists in your college.`,
            });
        }

        const newHostel = await Hostel.create({
            name,
            collegeId,
            capacity,
        });

        logger.info('Hostel created', {
            hostelId: newHostel._id.toString(),
            name,
            collegeId: collegeId.toString(),
            adminId: adminId.toString(),
        });
        await invalidateCacheByPrefix(`cache:hostel:list:${collegeId.toString()}:`);

        return res.status(201).json({
            success: true,
            message: 'Hostel created successfully',
            hostel: newHostel,
        });

    } catch (err) {
        logger.error('Failed to create hostel', {
            error: err.message,
            collegeId: collegeId?.toString?.(),
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to create hostel',
            error: err.message,
        });
    }
}

/**
 * List all hostels for the user's college, each with assigned wardens
 */
export async function listHostels(req, res) {
    try {
        const { collegeId } = req.user;

        const hostels = await Hostel.find({ collegeId }).sort({ name: 1 }).lean();

        // Fetch all wardens for this college and group by hostelId
        const wardens = await User.find({ role: 'warden', collegeId })
            .select('_id name email hostelId')
            .lean();

        const wardensByHostel = {};
        for (const w of wardens) {
            const hid = w.hostelId?.toString();
            if (!hid) continue;
            if (!wardensByHostel[ hid ]) wardensByHostel[ hid ] = [];
            wardensByHostel[ hid ].push({ _id: w._id, name: w.name, email: w.email });
        }

        const result = hostels.map((h) => ({
            ...h,
            wardens: wardensByHostel[ h._id.toString() ] || [],
        }));

        return res.status(200).json({
            success: true,
            hostels: result,
        });
    } catch (err) {
        logger.error('Failed to list hostels', { error: err.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to list hostels',
            error: err.message,
        });
    }
}

