import { Router } from "express";
import { registerCollege, getCollegesList, getCollegeHostels } from "../controllers/college.controller.js";
import { problemUpload } from "../config/cloudinary.js";
import { handleMulterError } from "../middleware/multerErrorHandler.js";
import { cacheResponse } from "../middleware/cache.middleware.js";

const router = Router();

// Public routes
router.post("/register", handleMulterError(problemUpload.single("logo")), registerCollege);
router.get("/list", cacheResponse({ namespace: "college:list", ttlSeconds: 120 }), getCollegesList);
router.get("/:collegeId/hostels", getCollegeHostels);

export default router;
