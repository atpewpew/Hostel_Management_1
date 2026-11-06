import request from "supertest";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
import Notification from "../models/notification.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestStudent,
  createTestNotification,
} from "./testUtils.js";

describe("Notification API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- GET /api/notifications ---

  it("returns empty notifications for new user → 200, []", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .get("/api/notifications")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notifications).toHaveLength(0);
  });

  it("returns seeded notifications for user → 200, 2 items", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id, { title: "Notif 1" });
    await createTestNotification(student._id, college._id, { title: "Notif 2" });

    const res = await request(app)
      .get("/api/notifications")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
  });

  // --- GET /api/notifications/unread-count ---

  it("returns unread count correctly → 200, count = 2", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id, { read: false });
    await createTestNotification(student._id, college._id, { read: false });
    await createTestNotification(student._id, college._id, { read: true, readAt: new Date() });

    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  // --- PATCH /api/notifications/:id/read ---

  it("marks a single notification as read → 200, read: true", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const notif = await createTestNotification(student._id, college._id);

    const res = await request(app)
      .patch(`/api/notifications/${notif._id}/read`)
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notification.read).toBe(true);
  });

  it("returns 404 when marking non-existent notification → 404", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/notifications/${fakeId}/read`)
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(404);
  });

  // --- PATCH /api/notifications/read-all ---

  it("marks all notifications as read → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id);
    await createTestNotification(student._id, college._id);

    const res = await request(app)
      .patch("/api/notifications/read-all")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify all are read
    const unread = await Notification.countDocuments({ userId: student._id, read: false });
    expect(unread).toBe(0);
  });

  // --- Isolation ---

  it("does not return other user's notifications → 200, []", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const studentA = await createTestStudent(college._id, hostel._id);
    const studentB = await createTestStudent(college._id, hostel._id, {
      email: "other@test.edu",
      rollNo: "202",
      roomNo: "12",
    });

    await createTestNotification(studentB._id, college._id, { title: "For B only" });

    const res = await request(app)
      .get("/api/notifications")
      .set("Cookie", [authCookieFor(studentA._id)]);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
  });

  // --- Query params: limit, skip, unreadOnly ---

  it("respects limit query param → returns at most N", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id, { title: "A" });
    await createTestNotification(student._id, college._id, { title: "B" });
    await createTestNotification(student._id, college._id, { title: "C" });

    const res = await request(app)
      .get("/api/notifications?limit=2")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
  });

  it("respects skip query param → skips first N", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id, { title: "First" });
    await createTestNotification(student._id, college._id, { title: "Second" });

    const res = await request(app)
      .get("/api/notifications?skip=1&limit=50")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it("respects unreadOnly=true → returns only unread", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id, { read: false });
    await createTestNotification(student._id, college._id, { read: true, readAt: new Date() });

    const res = await request(app)
      .get("/api/notifications?unreadOnly=true")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].read).toBe(false);
  });

  it("returns totalCount and hasMore correctly", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await createTestNotification(student._id, college._id);

    const res = await request(app)
      .get("/api/notifications?limit=50")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.hasMore).toBe(false);
  });
});
