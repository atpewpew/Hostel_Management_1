import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles, scopedProblemsFilter, isProblemInScope, scopedFeeFilter } from "../middleware/roles.js";
import { domainValidation } from "../middleware/domainValidation.middleware.js";
import { handleMulterError } from "../middleware/multerErrorHandler.js";
import { cacheResponse, invalidateCacheByPrefix } from "../middleware/cache.middleware.js";
import College from "../models/college.model.js";
import User from "../models/user.model.js";
import {
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestStudent,
  createTestHostel,
  createTestWarden,
  createTestAdmin,
} from "./testUtils.js";

describe("Middleware", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // === authMiddleware ===

  it("returns 401 when auth token is missing", async () => {
    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure");
    expect(res.status).toBe(401);
  });

  it("allows request with valid JWT token", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const user = await createTestStudent(college._id, hostel._id);
    const token = jwt.sign({ userID: user._id.toString() }, process.env.JWT_SECRET);

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure").set("Cookie", [`jwt=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects expired JWT token", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const user = await createTestStudent(college._id, hostel._id);
    const token = jwt.sign(
      { userID: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "0s" }
    );

    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure").set("Cookie", [`jwt=${token}`]);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("rejects malformed JWT token", async () => {
    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure").set("Cookie", ["jwt=not.a.valid.token"]);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("returns 401 when token is valid but user no longer exists", async () => {
    const token = jwt.sign({ userID: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure").set("Cookie", [`jwt=${token}`]);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it("returns 500 for unexpected auth middleware errors", async () => {
    const verifySpy = jest.spyOn(jwt, "verify").mockImplementation(() => {
      throw new Error("unexpected");
    });
    const testApp = express();
    testApp.use(cookieParser());
    testApp.get("/secure", authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secure").set("Cookie", ["jwt=any-token"]);
    expect(res.status).toBe(500);
    verifySpy.mockRestore();
  });

  // === authorizeRoles ===

  it("blocks unauthorized role", async () => {
    const testApp = express();
    testApp.get(
      "/admin",
      (req, res, next) => {
        req.user = { role: "student" };
        next();
      },
      authorizeRoles("collegeAdmin"),
      (req, res) => res.json({ ok: true })
    );

    const res = await request(testApp).get("/admin");
    expect(res.status).toBe(403);
  });

  it("allows request when role matches", async () => {
    const testApp = express();
    testApp.get(
      "/warden-area",
      (req, res, next) => {
        req.user = { role: "warden" };
        next();
      },
      authorizeRoles("warden", "collegeAdmin"),
      (req, res) => res.json({ ok: true })
    );

    const res = await request(testApp).get("/warden-area");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 401 when no user is attached to request", async () => {
    const testApp = express();
    testApp.get("/secured", authorizeRoles("student"), (req, res) => res.json({ ok: true }));

    const res = await request(testApp).get("/secured");
    expect(res.status).toBe(401);
  });

  // === domainValidation ===

  it("rejects domain mismatch in domainValidation", async () => {
    const college = await createTestCollege({ emailDomain: "@college.edu", adminEmail: "admin@college.edu" });

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) =>
      res.json({ ok: true })
    );

    const res = await request(testApp).post("/check-domain").send({
      email: "user@other.edu",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(403);
  });

  it("passes domainValidation when email matches college domain", async () => {
    const college = await createTestCollege();

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) =>
      res.json({ ok: true })
    );

    const res = await request(testApp).post("/check-domain").send({
      email: "user@test.edu",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects missing email in domainValidation → 400", async () => {
    const college = await createTestCollege();

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      collegeId: college._id.toString(),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("rejects missing collegeId in domainValidation → 400", async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      email: "user@test.edu",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it("rejects non-existent college in domainValidation → 404", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      email: "user@test.edu",
      collegeId: fakeId.toString(),
    });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/College not found/i);
  });

  it("returns 500 when domainValidation throws unexpectedly", async () => {
    const collegeSpy = jest.spyOn(College, "findById").mockRejectedValue(new Error("db fail"));
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      email: "user@test.edu",
      collegeId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(500);
    collegeSpy.mockRestore();
  });

  it("rejects invalid email format in domainValidation → 400", async () => {
    const college = await createTestCollege();
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      email: "no-at-sign",
      collegeId: college._id.toString(),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid email/i);
  });

  it("blocks signup for pending college in domainValidation → 403", async () => {
    const college = await createTestCollege({ status: "pending" });
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/check-domain", domainValidation, (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/check-domain").send({
      email: "student@test.edu",
      collegeId: college._id.toString(),
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pending/i);
  });

  // === handleMulterError ===

  it("passes through when no multer error → 200", async () => {
    const mockMulter = (req, res, cb) => cb(null); // no error
    const testApp = express();
    testApp.post("/upload", handleMulterError(mockMulter), (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/upload");
    expect(res.status).toBe(200);
  });

  it("handles file type error → 400", async () => {
    const mockMulter = (req, res, cb) => cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
    const testApp = express();
    testApp.post("/upload", handleMulterError(mockMulter), (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/upload");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/format allowed/i);
  });

  it("handles LIMIT_FILE_SIZE error → 400", async () => {
    const err = new Error("File too large");
    err.code = "LIMIT_FILE_SIZE";
    const mockMulter = (req, res, cb) => cb(err);
    const testApp = express();
    testApp.post("/upload", handleMulterError(mockMulter), (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/upload");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10MB/i);
  });

  it("handles generic MulterError → 400", async () => {
    const err = new Error("Unexpected field");
    err.name = "MulterError";
    err.code = "LIMIT_UNEXPECTED_FILE";
    const mockMulter = (req, res, cb) => cb(err);
    const testApp = express();
    testApp.post("/upload", handleMulterError(mockMulter), (req, res) => res.json({ ok: true }));

    const res = await request(testApp).post("/upload");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unexpected field/i);
  });

  it("passes unknown errors to next error handler", async () => {
    const err = new Error("Something totally unexpected");
    const mockMulter = (req, res, cb) => cb(err);
    const testApp = express();
    testApp.post("/upload", handleMulterError(mockMulter), (req, res) => res.json({ ok: true }));
    // eslint-disable-next-line no-unused-vars
    testApp.use((err, req, res, next) => res.status(500).json({ message: err.message }));

    const res = await request(testApp).post("/upload");
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Something totally unexpected/i);
  });

  // === scopedProblemsFilter ===

  it("returns student-scoped filter for students", () => {
    const userId = new mongoose.Types.ObjectId();
    const collegeId = new mongoose.Types.ObjectId();
    const req = { user: { _id: userId, role: "student", collegeId } };
    const filter = scopedProblemsFilter(req);
    expect(filter.studentId).toEqual(userId);
    expect(filter.collegeId).toEqual(collegeId);
  });

  it("returns hostel-scoped filter for wardens", () => {
    const hostelId = new mongoose.Types.ObjectId();
    const collegeId = new mongoose.Types.ObjectId();
    const req = { user: { role: "warden", hostelId, collegeId } };
    const filter = scopedProblemsFilter(req);
    expect(filter.hostelId).toEqual(hostelId);
    expect(filter.collegeId).toEqual(collegeId);
  });

  it("returns college-scoped filter for admin", () => {
    const collegeId = new mongoose.Types.ObjectId();
    const req = { user: { role: "collegeAdmin", collegeId } };
    const filter = scopedProblemsFilter(req);
    expect(filter).toEqual({ collegeId });
  });

  // === isProblemInScope ===

  it("returns true for admin regardless of problem", () => {
    const req = { user: { role: "collegeAdmin" } };
    const result = isProblemInScope({}, req);
    expect(result).toBe(true);
  });

  it("returns true for student viewing own problem", () => {
    const userId = new mongoose.Types.ObjectId();
    const req = { user: { _id: userId, role: "student" } };
    const result = isProblemInScope({ studentId: userId }, req);
    expect(result).toBe(true);
  });

  it("returns false for student viewing other's problem", () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const req = { user: { _id: userId, role: "student" } };
    const result = isProblemInScope({ studentId: otherUserId }, req);
    expect(result).toBe(false);
  });

  it("returns true for warden with matching hostel", () => {
    const hostelId = new mongoose.Types.ObjectId();
    const req = { user: { role: "warden", hostelId } };
    const result = isProblemInScope({ hostelId }, req);
    expect(result).toBe(true);
  });

  it("returns false for warden with different hostel", () => {
    const req = { user: { role: "warden", hostelId: new mongoose.Types.ObjectId() } };
    const result = isProblemInScope({ hostelId: new mongoose.Types.ObjectId() }, req);
    expect(result).toBe(false);
  });

  it("returns false for unknown role", () => {
    const req = { user: { role: "unknown" } };
    const result = isProblemInScope({}, req);
    expect(result).toBe(false);
  });

  // === scopedFeeFilter ===

  it("returns student-scoped fee filter", async () => {
    const userId = new mongoose.Types.ObjectId();
    const collegeId = new mongoose.Types.ObjectId();
    const req = { user: { _id: userId, role: "student", collegeId } };
    const filter = await scopedFeeFilter(req);
    expect(filter.studentId).toEqual(userId);
  });

  it("returns warden-scoped fee filter with hostel students", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);
    const student = await createTestStudent(college._id, hostel._id);

    const req = { user: { _id: warden._id, role: "warden", hostelId: hostel._id, collegeId: college._id } };
    const filter = await scopedFeeFilter(req);

    expect(filter.studentId.$in).toBeDefined();
    expect(filter.studentId.$in.map(String)).toContain(student._id.toString());
  });

  it("returns empty filter for warden without hostelId", async () => {
    const req = { user: { _id: new mongoose.Types.ObjectId(), role: "warden", collegeId: new mongoose.Types.ObjectId() } };
    const filter = await scopedFeeFilter(req);
    expect(filter.studentId.$in).toEqual([]);
  });

  it("returns college-scoped fee filter for admin", async () => {
    const collegeId = new mongoose.Types.ObjectId();
    const req = { user: { role: "collegeAdmin", collegeId } };
    const filter = await scopedFeeFilter(req);
    expect(filter).toEqual({ collegeId });
  });

  // === cacheResponse (Redis not available → bypass) ===

  it("cacheResponse bypasses when Redis not ready → next() called", async () => {
    const testApp = express();
    testApp.get(
      "/cached",
      cacheResponse({ namespace: "test", ttlSeconds: 60 }),
      (req, res) => res.json({ data: "ok" })
    );

    const res = await request(testApp).get("/cached");
    expect(res.status).toBe(200);
    expect(res.body.data).toBe("ok");
  });

  // === invalidateCacheByPrefix (Redis not ready → noop) ===

  it("invalidateCacheByPrefix does not throw when Redis not ready", async () => {
    await expect(invalidateCacheByPrefix("cache:test:")).resolves.toBeUndefined();
  });
});
