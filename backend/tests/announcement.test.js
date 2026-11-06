import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import mongoose from "mongoose";
import { app } from "../index.js";
import Announcement from "../models/announcement.model.js";
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

describe("Announcement API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("authenticated user can list announcements for their college", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Announcement.create({
      title: "Holiday Notice",
      message: "College closed on Monday",
      collegeId: college._id,
      postedBy: { name: "Admin", email: "admin@test.edu", role: "collegeAdmin" },
    });

    const res = await request(app)
      .get("/api/announcement")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe("Holiday Notice");
  });

  it("student from different college does not see other college's announcements", async () => {
    const college1 = await createTestCollege();
    const college2 = await createTestCollege({
      name: "Other College",
      emailDomain: "@other.edu",
      adminEmail: "admin@other.edu",
    });
    const hostel = await createTestHostel(college1._id);
    const student = await createTestStudent(college1._id, hostel._id);

    await Announcement.create({
      title: "Other College Notice",
      message: "Not for you",
      collegeId: college2._id,
      postedBy: { name: "Admin2", email: "admin@other.edu", role: "collegeAdmin" },
    });

    const res = await request(app)
      .get("/api/announcement")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it("warden can create an announcement", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const res = await request(app)
      .post("/api/announcement")
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ title: "Curfew Update", message: "Curfew changed to 10 PM" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Curfew Update");
  });

  it("student cannot create an announcement", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/announcement")
      .set("Cookie", [authCookieFor(student._id)])
      .send({ title: "Student Post", message: "This should be blocked" });

    expect(res.status).toBe(403);
  });

  it("rejects announcement creation with missing title", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/announcement")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ message: "No title provided" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("warden can delete their college's announcement", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const announcement = await Announcement.create({
      title: "To Be Deleted",
      message: "This will be removed",
      collegeId: college._id,
      postedBy: { name: "Test Warden", email: "warden@test.edu", role: "warden" },
    });

    const res = await request(app)
      .delete(`/api/announcement/${announcement._id}`)
      .set("Cookie", [authCookieFor(warden._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 when deleting non-existent announcement", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/announcement/${fakeId}`)
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(404);
  });

  it("any authenticated user can add a comment to an announcement", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const announcement = await Announcement.create({
      title: "Maintenance Notice",
      message: "Water supply off on Sunday",
      collegeId: college._id,
      postedBy: { name: "Admin", email: "admin@test.edu", role: "collegeAdmin" },
    });

    const res = await request(app)
      .post(`/api/announcement/${announcement._id}/comments`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ message: "Thanks for the heads up!" });

    expect(res.status).toBe(201);
    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.comments[0].message).toBe("Thanks for the heads up!");
  });

  it("rejects empty comment body", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const announcement = await Announcement.create({
      title: "Test Notice",
      message: "Some message",
      collegeId: college._id,
      postedBy: { name: "Admin", email: "admin@test.edu", role: "collegeAdmin" },
    });

    const res = await request(app)
      .post(`/api/announcement/${announcement._id}/comments`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ message: "" });

    expect(res.status).toBe(400);
  });
});
