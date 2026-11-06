import request from "supertest";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

// Mock email before importing app
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
  createTestStudent,
  createTestManager,
  createTestMess,
} from "./testUtils.js";

describe("Manager API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- RBAC ---

  it("non-manager gets 403 on /api/manager/stats", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .get("/api/manager/stats")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(403);
  });

  // --- GET /api/manager/stats ---

  it("manager can get dashboard stats → 200, stats object", async () => {
    const manager = await createTestManager();
    const college = await createTestCollege();
    await createTestHostel(college._id);
    await createTestMess(college._id);

    const res = await request(app)
      .get("/api/manager/stats")
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty("totalColleges");
    expect(res.body.stats).toHaveProperty("totalHostels");
    expect(res.body.stats).toHaveProperty("totalMesses");
    expect(res.body).toHaveProperty("collegeTrend");
    expect(res.body).toHaveProperty("userTrend");
  });

  // --- GET /api/manager/colleges ---

  it("manager can list all colleges → 200, colleges with counts", async () => {
    const manager = await createTestManager();
    await createTestCollege();

    const res = await request(app)
      .get("/api/manager/colleges")
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.colleges.length).toBeGreaterThanOrEqual(1);
  });

  // --- GET /api/manager/colleges/pending ---

  it("manager can list pending colleges → 200, only pending", async () => {
    const manager = await createTestManager();
    await createTestCollege({ status: "pending", emailDomain: "@pending.edu", adminEmail: "admin@pending.edu" });
    await createTestCollege({ status: "approved" });

    const res = await request(app)
      .get("/api/manager/colleges/pending")
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(200);
    expect(res.body.colleges.every((c) => c.status === "pending")).toBe(true);
  });

  // --- POST /api/manager/colleges/:id/approve ---

  it("manager can approve a pending college → 200, approved", async () => {
    const manager = await createTestManager();
    const college = await createTestCollege({
      status: "pending",
      emailDomain: "@approve.edu",
      adminEmail: "admin@approve.edu",
    });

    const res = await request(app)
      .post(`/api/manager/colleges/${college._id}/approve`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.college.status).toBe("approved");
  });

  it("approve rejects already-approved college → 400", async () => {
    const manager = await createTestManager();
    const college = await createTestCollege({ status: "approved" });

    const res = await request(app)
      .post(`/api/manager/colleges/${college._id}/approve`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already approved/i);
  });

  it("approve returns 404 for non-existent college", async () => {
    const manager = await createTestManager();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/manager/colleges/${fakeId}/approve`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(404);
  });

  // --- POST /api/manager/colleges/:id/reject ---

  it("manager can reject a pending college → 200, rejected", async () => {
    const manager = await createTestManager();
    const college = await createTestCollege({
      status: "pending",
      emailDomain: "@reject.edu",
      adminEmail: "admin@reject.edu",
    });

    const res = await request(app)
      .post(`/api/manager/colleges/${college._id}/reject`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("reject returns 404 for non-existent college", async () => {
    const manager = await createTestManager();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/manager/colleges/${fakeId}/reject`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(404);
  });

  it("reject rejects already-rejected college → 400", async () => {
    const manager = await createTestManager();
    const college = await createTestCollege({
      status: "rejected",
      emailDomain: "@rej.edu",
      adminEmail: "admin@rej.edu",
    });

    const res = await request(app)
      .post(`/api/manager/colleges/${college._id}/reject`)
      .set("Cookie", [authCookieFor(manager._id)]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already rejected/i);
  });
});
