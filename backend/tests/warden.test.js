import request from "supertest";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

// Mock email before importing app (appointWarden sends email)
await jest.unstable_mockModule("../utils/email-client.js", () => ({
  sendEmail: jest.fn(async () => ({ messageId: "mock-id" })),
  getEmailUser: jest.fn(() => "test@hostelia.local"),
}));

const { app } = await import("../index.js");
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestAdmin,
  createTestStudent,
  createTestWarden,
} from "./testUtils.js";

describe("Warden API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- GET /api/warden ---

  it("admin can list wardens → 200, wardens array", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    await createTestWarden(college._id, hostel._id);

    const res = await request(app)
      .get("/api/warden")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.wardens.length).toBe(1);
  });

  it("student cannot list wardens → 403", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .get("/api/warden")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(403);
  });

  // --- POST /api/warden/create ---

  it("admin can appoint a warden → 201, warden created", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        name: "New Warden",
        email: "newwarden@test.edu",
        hostelId: hostel._id.toString(),
        password: "warden123",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.warden.role).toBe("warden");
  });

  it("rejects warden with email outside college domain → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        name: "Bad Warden",
        email: "warden@wrongdomain.com",
        hostelId: hostel._id.toString(),
        password: "warden123",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/domain/i);
  });

  it("rejects duplicate warden email → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    await createTestWarden(college._id, hostel._id);

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        name: "Dup Warden",
        email: "warden@test.edu", // already exists from createTestWarden
        hostelId: hostel._id.toString(),
        password: "warden123",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("rejects invalid hostel ID → 404", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const fakeHostelId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        name: "Ghost Warden",
        email: "ghost@test.edu",
        hostelId: fakeHostelId.toString(),
        password: "warden123",
      });

    expect(res.status).toBe(404);
  });

  it("rejects warden if hostel already has 2 wardens → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);

    // Create 2 wardens for this hostel
    await createTestWarden(college._id, hostel._id, { email: "w1@test.edu" });
    await createTestWarden(college._id, hostel._id, { email: "w2@test.edu", name: "Warden 2" });

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        name: "Third Warden",
        email: "w3@test.edu",
        hostelId: hostel._id.toString(),
        password: "warden123",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2 wardens/i);
  });

  it("rejects warden with missing fields (validation) → 400", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/warden/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({});

    expect(res.status).toBe(400);
  });
});
