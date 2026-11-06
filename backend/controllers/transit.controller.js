import { z } from 'zod';
import Transit from '../models/transit.model.js';
import User from '../models/user.model.js';
import { logger } from '../middleware/logger.js';

const createTransitSchema = z.object({
    purpose: z.string().trim().max(500).optional().default(''),
    transitStatus: z.enum([ 'ENTRY', 'EXIT' ]),
    date: z.coerce.date(),
    time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Time must be in HH:MM:SS format').optional(),
}).superRefine((data, ctx) => {
    if (data.transitStatus !== 'EXIT') {
        return;
    }

    const purpose = data.purpose?.trim() || '';
    if (purpose.length < 3) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'purpose' ],
            message: 'Purpose must be at least 3 characters for EXIT',
        });
        return;
    }

    if (!/\p{L}/u.test(purpose)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [ 'purpose' ],
            message: 'Purpose must contain alphabetic characters',
        });
    }
});

export async function createTransitEntry(req, res) {
    const parsed = createTransitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: z.treeifyError(parsed.error),
        });
    }

    const { _id: userId } = req.user;

    try {
        const lastTransit = await Transit.findOne({ studentId: userId, collegeId: req.user.collegeId }).sort({ createdAt: -1 });
        const entryDate = parsed.data.date;
        const entryTime = parsed.data.time || new Date().toTimeString().split(' ')[ 0 ];
        const normalizedPurpose = parsed.data.purpose?.trim() || '';

        if (!lastTransit && parsed.data.transitStatus === 'ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'First transit record must be EXIT before ENTRY',
            });
        }

        if (lastTransit) {
            const expectedStatus = lastTransit.transitStatus === 'ENTRY' ? 'EXIT' : 'ENTRY';
            if (parsed.data.transitStatus !== expectedStatus) {
                return res.status(400).json({
                    success: false,
                    message: `Next transit record must be ${expectedStatus} after a ${lastTransit.transitStatus}`,
                    lastTransitStatus: lastTransit.transitStatus
                });
            }
            const lastDateTime = buildDateTime(lastTransit.date, lastTransit.time);
            const nextDateTime = buildDateTime(entryDate, entryTime);
            if (nextDateTime <= lastDateTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Next transit record time must be after the previous record time',
                    lastRecordTimestamp: lastDateTime.toISOString()
                });
            }
        }
        const transitData = {
            studentId: userId,
            collegeId: req.user.collegeId,
            purpose: parsed.data.transitStatus === 'EXIT'
                ? normalizedPurpose
                : (lastTransit?.purpose || 'Returned to hostel'),
            transitStatus: parsed.data.transitStatus,
            date: entryDate,
            time: entryTime,
        };

        const transit = await Transit.create(transitData);
        logger.info('Transit entry created', {
            transitId: transit._id.toString(),
            transitStatus: parsed.data.transitStatus,
            studentId: userId.toString()
        });
        return res.status(201).json({
            success: true,
            message: 'Transit entry created successfully',
            transit,
        });
    } catch (err) {
        logger.error('Failed to create transit entry', { error: err.message, userId: userId?.toString?.() });
        return res.status(500).json({
            success: false,
            message: 'Failed to create transit entry',
            error: err.message
        });
    }
}

export async function listTransitEntries(req, res) {
    try {
        const filter = await buildTransitFilter(req);
        const transitEntries = await Transit.find(filter)
            .populate({
                path: 'studentId',
                select: 'name rollNo hostelId roomNo',
                populate: { path: 'hostelId', select: 'name' },
            })
            .sort({ createdAt: -1 });
        const entriesWithHostelName = transitEntries.map((e) => {
            const plain = e.toObject ? e.toObject() : { ...e };
            const sid = plain.studentId;
            if (sid) {
                plain.studentId = {
                    _id: sid._id,
                    name: sid.name,
                    rollNo: sid.rollNo,
                    roomNo: sid.roomNo,
                    hostelId: sid.hostelId?._id?.toString() ?? sid.hostelId?.toString(),
                    hostelName: sid.hostelId?.name ?? null,
                };
            }
            return plain;
        });
        logger.info('Transit entries fetched', { count: transitEntries.length });
        return res.status(200).json({
            success: true,
            message: 'Transit entries fetched',
            transitEntries: entriesWithHostelName
        });
    } catch (err) {
        logger.error('Failed to list transit entries', { error: err.message });
        return res.status(500).json({
            success: false,
            message: 'Failed to list transit entries',
            error: err.message
        });
    }
}

function buildDateTime(dateValue, timeString) {
    const dateObj = new Date(dateValue);
    const [ hours = 0, minutes = 0, seconds = 0 ] = (timeString || '00:00:00').split(':').map(Number);
    dateObj.setHours(hours, minutes, seconds, 0);
    return dateObj;
}

async function buildTransitFilter(req) {
    const role = req.user?.role;
    const collegeId = req.user?.collegeId;
    if (role === 'student') {
        return { studentId: req.user._id, collegeId };
    }
    if (role === 'warden') {
        const hostel = req.user?.hostelId;
        if (!hostel) {
            logger.warn('Transit filter: warden without hostel assignment', { userId: req.user?._id?.toString?.() });
            return { studentId: { $in: [] } };
        }
        const hostelStudents = await User.find({ hostelId: hostel, collegeId }).select('_id');
        const studentIds = hostelStudents.map((student) => student._id);
        if (studentIds.length === 0) {
            return { studentId: { $in: [] } };
        }
        return { studentId: { $in: studentIds }, collegeId };
    }
    return { collegeId };
}

