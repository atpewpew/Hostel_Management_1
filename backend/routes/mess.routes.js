// write a basic router 

import { Router } from "express";
import {
    getMenu, submitFeedback, getAllFeedbacks, updateMenu,
    createMess, listMesses, deleteMess,
} from "../controllers/mess.controller.js";
import { authorizeRoles } from "../middleware/roles.js";
import { cacheResponse } from "../middleware/cache.middleware.js";

const router = Router();

// Create a new mess (collegeAdmin only)
router.post("/create", authorizeRoles('collegeAdmin'), createMess);
router.get("/list", cacheResponse({ namespace: "mess:list", ttlSeconds: 120 }), listMesses);
router.get("/menu", cacheResponse({ namespace: "mess:menu", ttlSeconds: 300 }), getMenu);
router.put("/menu", authorizeRoles('collegeAdmin', 'warden'), updateMenu);
router.post("/feedback", authorizeRoles('student'), submitFeedback);
router.get("/feedback", authorizeRoles('collegeAdmin', 'warden'), getAllFeedbacks);
router.delete("/:id", authorizeRoles('collegeAdmin'), deleteMess);

export default router;
