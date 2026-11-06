import request from "supertest";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
import Mess from "../models/mess.model.js";
import Menu from "../models/menu.model.js";
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
  createTestMess,
} from "./testUtils.js";

describe("Mess API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- POST /api/mess/create ---

  it("admin can create a mess → 201, mess returned", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/mess/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "South Mess", capacity: 150 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.mess.name).toBe("South Mess");
  });

  it("rejects mess with empty name → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/mess/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("student cannot create mess → 403", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/mess/create")
      .set("Cookie", [authCookieFor(student._id)])
      .send({ name: "Mess X" });

    expect(res.status).toBe(403);
  });

  // --- GET /api/mess/list ---

  it("admin can list messes → 200, array", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    await createTestMess(college._id);

    const res = await request(app)
      .get("/api/mess/list")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messes.length).toBe(1);
  });

  // --- GET /api/mess/menu ---

  it("returns 400 if messId not provided for menu", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .get("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/messId/i);
  });

  it("returns 404 if mess not found for menu", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/mess/menu?messId=${fakeId}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(404);
  });

  it("returns menu for valid mess → 200, menu object", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);

    // Seed a menu entry
    await Menu.create({
      day: "Monday",
      messId: mess._id,
      collegeId: college._id,
      meals: { Breakfast: ["Idli", "Dosa"], Lunch: ["Rice", "Dal"] },
    });

    const res = await request(app)
      .get(`/api/mess/menu?messId=${mess._id}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.menu.Monday).toBeDefined();
    expect(res.body.menu.Monday.Breakfast).toContain("Idli");
  });

  // --- PUT /api/mess/menu ---

  it("admin can update menu for a day → 200, menu updated", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);

    const res = await request(app)
      .put("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        messId: mess._id.toString(),
        updates: { Monday: { Breakfast: ["Upma", "Poha"] } },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.menu.Monday.Breakfast).toContain("Upma");
  });

  it("rejects menu update without messId → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .put("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ updates: { Monday: { Breakfast: ["Item"] } } });

    expect(res.status).toBe(400);
  });

  // --- POST /api/mess/feedback ---

  it("student can submit feedback → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/mess/feedback")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        date: new Date().toISOString(),
        mealType: "Lunch",
        rating: 4,
        comment: "Good food today",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.feedback.rating).toBe(4);
  });

  it("rejects feedback with invalid rating (>5) → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/mess/feedback")
      .set("Cookie", [authCookieFor(student._id)])
      .send({ date: new Date().toISOString(), mealType: "Lunch", rating: 6 });

    expect(res.status).toBe(400);
  });

  // --- GET /api/mess/feedback ---

  it("admin can get all feedbacks → 200, feedbacks array", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .get("/api/mess/feedback")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.feedbacks)).toBe(true);
  });

  it("student cannot get all feedbacks → 403", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .get("/api/mess/feedback")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(403);
  });

  // --- DELETE /api/mess/:id ---

  it("admin can delete a mess → 200", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);

    const res = await request(app)
      .delete(`/api/mess/${mess._id}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("delete returns 404 for non-existent mess", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/mess/${fakeId}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(404);
  });

  // --- Additional coverage ---

  it("rejects duplicate mess name within same college → 409", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    await createTestMess(college._id, { name: "Unique Mess" });

    const res = await request(app)
      .post("/api/mess/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "Unique Mess", capacity: 100 });

    expect(res.status).toBe(409);
  });

  it("admin can update menu for multiple days at once → 200", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);

    const res = await request(app)
      .put("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        messId: mess._id.toString(),
        updates: {
          Monday: { Breakfast: ["Idli"], Lunch: ["Rice"] },
          Tuesday: { Dinner: ["Roti", "Dal"] },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.updatedCount).toBe(3); // 3 meal-type entries
    expect(res.body.menu.Monday).toBeDefined();
    expect(res.body.menu.Tuesday).toBeDefined();
  });

  it("student can submit feedback without optional comment → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/mess/feedback")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        date: new Date().toISOString(),
        mealType: "Breakfast",
        rating: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.feedback.comment).toBe("");
  });

  it("returns 404 when updating menu for non-existent mess", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .put("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        messId: fakeId.toString(),
        updates: { Monday: { Breakfast: ["Item"] } },
      });

    expect(res.status).toBe(404);
  });

  it("rejects menu update with invalid data → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);

    // Empty updates object
    const res = await request(app)
      .put("/api/mess/menu")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ messId: mess._id.toString(), updates: {} });

    expect(res.status).toBe(400);
  });

  it("student can list messes → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await createTestMess(college._id);

    const res = await request(app)
      .get("/api/mess/list")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.messes.length).toBe(1);
  });

  it("delete mess cleans up assigned users' messId", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const mess = await createTestMess(college._id);
    const student = await createTestStudent(college._id, hostel._id, {
      messId: mess._id,
    });

    const res = await request(app)
      .delete(`/api/mess/${mess._id}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);

    // Verify student's messId was unset
    const { default: User } = await import("../models/user.model.js");
    const updated = await User.findById(student._id);
    expect(updated.messId).toBeUndefined();
  });
});
