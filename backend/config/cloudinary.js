import cloudinary from "cloudinary";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { logger } from "../middleware/logger.js";

// Ensure .env is loaded even when this module is imported before the app bootstraps
dotenv.config();

const isDev = process.env.NODE_ENV !== "production";

const isPlaceholderKey = (val) => {
  if (!val) return true;
  const l = val.toLowerCase();
  return (
    l.includes("placeholder") ||
    l.includes("your-") ||
    l === "hostelia_dev" ||
    l === "123456789012345" ||
    l === "abcdefghijklmnopqrstuvwxyz12"
  );
};

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "hostelia_dev",
  api_key: process.env.CLOUDINARY_API_KEY || "123456789012345",
  api_secret: process.env.CLOUDINARY_API_SECRET || "abcdefghijklmnopqrstuvwxyz12",
});

// Memory storage for multer (we will upload buffers directly to Cloudinary or disk)
const memoryStorage = multer.memoryStorage();

// File filter for images (problems)
const imageFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  return cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
};

// File filter for announcements (images and common docs)
const announcementFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf|doc|docx/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype.toLowerCase());
  if (extOk && mimeOk) return cb(null, true);
  return cb(
    new Error("Unsupported file type. Allowed: jpg, jpeg, png, pdf, doc, docx")
  );
};

// File filter for fees (images and PDF)
const feeFileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|pdf/;
  const allowedMimes = /^image\/(jpeg|jpg|png)$|^application\/pdf$/;
  const extOk = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowedMimes.test(file.mimetype.toLowerCase());
  if (extOk && mimeOk) return cb(null, true);
  return cb(new Error("Only .png, .jpg, .jpeg, and .pdf format allowed!"));
};

// Multer uploaders
export const problemUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: imageFilter,
});

export const announcementUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: announcementFileFilter,
});

export const feeUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: feeFileFilter, // Allow images (jpeg, jpg, png) and PDF
});

// Helper: convert Buffer to Readable stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Helper: Local fallback storage for development
async function saveLocalUpload(buffer, options = {}) {
  const folder = options.folder || "uploads";
  // Safe relative directory path
  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_\-\/]/g, "");
  const uploadDir = path.resolve("public/uploads", sanitizedFolder);
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const ext = options.resource_type === "raw" ? ".pdf" : ".jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const filePath = path.join(uploadDir, uniqueName);

  await fs.promises.writeFile(filePath, buffer);

  const port = process.env.PORT || 3000;
  const fileUrl = `http://localhost:${port}/uploads/${sanitizedFolder}/${uniqueName}`;

  logger.info(`Saved upload to local storage fallback: ${fileUrl}`);

  return {
    secure_url: fileUrl,
    url: fileUrl,
    public_id: uniqueName,
    local: true,
  };
}

// Helper: upload a Buffer to Cloudinary using upload_stream (with dev local fallback)
export async function uploadBufferToCloudinary(buffer, options = {}) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // In development, if Cloudinary keys are placeholders, save directly to local uploads
  if (
    isDev &&
    (isPlaceholderKey(cloudName) ||
      isPlaceholderKey(apiKey) ||
      isPlaceholderKey(apiSecret))
  ) {
    return saveLocalUpload(buffer, options);
  }

  const folder = options.folder || "uploads";
  const resource_type = options.resource_type || "image";
  const public_id = options.public_id;

  try {
    return await new Promise((resolve, reject) => {
      const upload = cloudinary.v2.uploader.upload_stream(
        { folder, resource_type, public_id },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );

      bufferToStream(buffer).pipe(upload);
    });
  } catch (cloudErr) {
    if (isDev) {
      logger.warn(
        `Cloudinary upload failed (${cloudErr.message}). Falling back to local storage for development.`
      );
      return saveLocalUpload(buffer, options);
    }
    throw cloudErr;
  }
}

// Helper: extract secure URL from Cloudinary upload result
export function getSecureUrl(uploadResult) {
  return uploadResult?.secure_url || uploadResult?.url;
}

export const cloudinaryClient = cloudinary.v2;

export default {
  cloudinary: cloudinary.v2,
  problemUpload,
  announcementUpload,
  feeUpload,
  uploadBufferToCloudinary,
  getSecureUrl,
  cloudinaryClient: cloudinary.v2,
};
