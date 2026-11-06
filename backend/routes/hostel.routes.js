import { Router } from 'express';
import { authorizeRoles } from '../middleware/roles.js';
import { createHostel, listHostels } from '../controllers/hostel.controller.js';
import { cacheResponse } from '../middleware/cache.middleware.js';

const router = Router();

// List all hostels with their wardens
router.get('/list', cacheResponse({ namespace: 'hostel:list', ttlSeconds: 120 }), listHostels);

// Create a new hostel (collegeAdmin only)
router.post('/create', authorizeRoles('collegeAdmin'), createHostel);

export default router;
