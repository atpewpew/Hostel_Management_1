import { Router } from "express";
import {
  getLostFoundItems,
  getMyLostFoundItems,
  getLostFoundItemById,
  createLostFoundItem,
  updateLostFoundItem,
  updateItemStatus,
  submitClaim,
  respondToClaim,
  deleteLostFoundItem,
} from "../controllers/lostFound.controller.js";
import { lostFoundUpload } from "../config/cloudinary.js";
import { cacheResponse } from "../middleware/cache.middleware.js";

const router = Router();

router.get("/", cacheResponse({ namespace: "lostfound", ttlSeconds: 60 }), getLostFoundItems);
router.get("/my", getMyLostFoundItems);
router.get("/:id", getLostFoundItemById);

router.post("/", lostFoundUpload.single("itemImage"), createLostFoundItem);
router.put("/:id", lostFoundUpload.single("itemImage"), updateLostFoundItem);
router.patch("/:id/status", updateItemStatus);

router.post("/:id/claim", submitClaim);
router.patch("/:id/claim/:claimId", respondToClaim);

router.delete("/:id", deleteLostFoundItem);

export default router;

