import request from "supertest";
import bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

// Mock email before importing app (OTP flow sends emails)
await jest.unstable_mockModule("../utils/email-client.js", () => ({
  sendEmail: jest.fn(async () => ({ messageId: "mock-id" })),
  getEmailUser: jest.fn(() => "test@hostelia.local"),
}));

const { app } = await import("../index.js");
import College from "../models/college.model.js";
import Hostel from "../models/hostel.model.js";
import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestStudent,
} from "./testUtils.js";

describe("Auth API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("signs up student successfully", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);

    const res = await request(app).post("/api/auth/signup").send({
      name: "Alice Student",
      rollNo: "101",
      email: "alice@test.edu",
      collegeId: college._id.toString(),
      hostelId: hostel._id.toString(),
      roomNo: "101",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe("alice@test.edu");
  });

  it("rejects signup with duplicate email", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    await createTestStudent(college._id, hostel._id);

    const res = await request(app).post("/api/auth/signup").send({
      name: "Alice Student",
      rollNo: "202",
      email: "student@test.edu",
      collegeId: college._id.toString(),
      hostelId: hostel._id.toString(),
      roomNo: "11",
      password: "secret123",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects signup with invalid roll number format", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);

    const res = await request(app).post("/api/auth/signup").send({
      name: "Alice Student",
      rollNo: "ab",
      email: "alice@test.edu",
      collegeId: college._id.toString(),
      hostelId: hostel._id.toString(),
      roomNo: "101",
      password: "secret123",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("logs in student with correct password", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    await createTestStudent(college._id, hostel._id);

    const res = await request(app).post("/api/auth/login").send({
      email: "student@test.edu",
      password: "password123",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("student");
  });

  it("rejects login with wrong password", async () => {
    const hashedPassword = await bcrypt.hash("correctpass", 1);
    const college = await createTestCollege();
    await User.create({
      name: "Bob",
      email: "bob@test.edu",
      rollNo: "102",
      password: hashedPassword,
      role: "student",
      collegeId: college._id,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "bob@test.edu",
      password: "wrongpass",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid Credentials/i);
  });

  it("rejects login for non-existent user", async () => {
    const college = await createTestCollege();

    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@test.edu",
      password: "somepass",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid Credentials/i);
  });

  it("rejects login for pending college", async () => {
    const college = await createTestCollege({ status: "pending" });
    const hashedPassword = await bcrypt.hash("pass123", 1);
    await User.create({
      name: "Pending User",
      email: "pending@test.edu",
      rollNo: "103",
      password: hashedPassword,
      role: "student",
      collegeId: college._id,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "pending@test.edu",
      password: "pass123",
      collegeId: college._id.toString(),
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("logs in manager with valid credentials", async () => {
    const hashedPassword = await bcrypt.hash("managerpass", 1);
    await User.create({
      name: "Manager",
      email: "manager@hostelia.com",
      password: hashedPassword,
      role: "manager",
    });

    const res = await request(app).post("/api/auth/manager-login").send({
      email: "manager@hostelia.com",
      password: "managerpass",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("manager");
  });

  it("rejects manager login with wrong password", async () => {
    const hashedPassword = await bcrypt.hash("correctpass", 1);
    await User.create({
      name: "Manager",
      email: "manager@hostelia.com",
      password: hashedPassword,
      role: "manager",
    });

    const res = await request(app).post("/api/auth/manager-login").send({
      email: "manager@hostelia.com",
      password: "wrongpass",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("logout clears cookies and returns 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ===== OTP Flow Tests =====

  it("generate-otp returns 200 for valid input → OTP sent email", async () => {
    const college = await createTestCollege();

    const res = await request(app).post("/api/auth/generate-otp").send({
      email: "newuser@test.edu",
      collegeId: college._id.toString(),
      name: "New User",
      rollNo: "301",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/OTP sent/i);

    // Verify OTP was stored in DB
    const otpRecord = await OTP.findOne({ email: "newuser@test.edu" });
    expect(otpRecord).not.toBeNull();
    expect(otpRecord.otp).toHaveLength(6);
  });

  it("generate-otp rejects existing email → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    await createTestStudent(college._id, hostel._id);

    const res = await request(app).post("/api/auth/generate-otp").send({
      email: "student@test.edu", // already exists
      collegeId: college._id.toString(),
      name: "Dup User",
      rollNo: "301",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("verify-otp accepts correct OTP → 200, verified", async () => {
    const college = await createTestCollege();

    // Seed an OTP record
    await OTP.create({ email: "verify@test.edu", otp: "123456" });

    const res = await request(app).post("/api/auth/verify-otp").send({
      email: "verify@test.edu",
      collegeId: college._id.toString(),
      otp: "123456",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.verified).toBe(true);

    // OTP should be deleted after verification
    const otpRecord = await OTP.findOne({ email: "verify@test.edu" });
    expect(otpRecord).toBeNull();
  });

  it("verify-otp rejects wrong OTP → 400, invalid", async () => {
    const college = await createTestCollege();
    await OTP.create({ email: "wrongotp@test.edu", otp: "123456" });

    const res = await request(app).post("/api/auth/verify-otp").send({
      email: "wrongotp@test.edu",
      collegeId: college._id.toString(),
      otp: "999999",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid OTP/i);
  });

  it("verify-otp rejects expired/unknown OTP → 400, not found", async () => {
    const college = await createTestCollege();

    const res = await request(app).post("/api/auth/verify-otp").send({
      email: "nootp@test.edu",
      collegeId: college._id.toString(),
      otp: "111111",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired|not found/i);
  });
});

