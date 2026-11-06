import request from "supertest";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { app } from "../index.js";
import User from "../models/user.model.js";
import College from "../models/college.model.js";
import FeeSubmission from "../models/feeSubmission.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestAdmin,
  createTestCollege,
  createTestHostel,
  createTestMess,
  createTestStudent,
  createTestWarden,
} from "./testUtils.js";

function payload(students, mode = "create") {
  return { students, mode };
}

function studentRow(overrides = {}) {
  return {
    name: "Bulk Student",
    rollNo: "301",
    email: "bulkstudent@test.edu",
    hostel: "A Block",
    roomNo: "10",
    mess: "Central Mess",
    password: "password123",
    ...overrides,
  };
}

describe("Bulk Upload API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("blocks non-admin/warden users from bulk upload", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    await createTestMess(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(student._id)])
      .send(payload([studentRow()]));

    expect(res.status).toBe(403);
  });

  it("returns 400 when request body fails validation", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ students: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/validation/i);
  });

  it("returns 404 when college is not found", async () => {
    const fakeCollegeId = new mongoose.Types.ObjectId();
    const admin = await createTestAdmin(fakeCollegeId);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(payload([studentRow()]));

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/college not found/i);
  });

  it("returns 403 when warden has no assigned hostel", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id);
    await createTestMess(college._id);
    const warden = await createTestWarden(college._id, undefined);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(warden._id)])
      .send(payload([studentRow()]));

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/assigned hostel/i);
  });

  it("reports per-row errors for domain, hostel, and mess lookup failures", async () => {
    const college = await createTestCollege({ emailDomain: "@test.edu" });
    const admin = await createTestAdmin(college._id);
    await createTestHostel(college._id, { name: "A Block" });
    await createTestMess(college._id, { name: "Central Mess" });

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(
        payload([
          studentRow({ email: "outside@other.edu" }),
          studentRow({ email: "hostelmissing@test.edu", rollNo: "302", hostel: "Z Block" }),
          studentRow({ email: "messmissing@test.edu", rollNo: "303", mess: "No Mess" }),
        ])
      );

    expect(res.status).toBe(200);
    expect(res.body.results.errors).toHaveLength(3);
    expect(res.body.results.created).toHaveLength(0);
  });

  it("enforces warden hostel restriction for non-assigned hostel rows", async () => {
    const college = await createTestCollege();
    const aBlock = await createTestHostel(college._id, { name: "A Block" });
    await createTestHostel(college._id, { name: "B Block" });
    await createTestMess(college._id, { name: "Central Mess" });
    const warden = await createTestWarden(college._id, aBlock._id);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(warden._id)])
      .send(payload([studentRow({ hostel: "B Block" })]));

    expect(res.status).toBe(200);
    expect(res.body.results.errors).toHaveLength(1);
    expect(res.body.results.errors[0].reason).toMatch(/assigned hostel/i);
  });

  it("create mode skips existing email and existing roll number", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id, { name: "A Block" });
    await createTestMess(college._id, { name: "Central Mess" });
    const admin = await createTestAdmin(college._id);

    await createTestStudent(college._id, hostel._id, {
      email: "exists@test.edu",
      rollNo: "304",
      roomNo: "11",
    });
    await createTestStudent(college._id, hostel._id, {
      email: "otherexists@test.edu",
      rollNo: "305",
      roomNo: "12",
    });

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(
        payload([
          studentRow({ email: "exists@test.edu", rollNo: "306" }),
          studentRow({ email: "newstudent@test.edu", rollNo: "305" }),
        ])
      );

    expect(res.status).toBe(200);
    expect(res.body.results.skipped).toHaveLength(2);
    expect(res.body.results.created).toHaveLength(0);
  });

  it("upsert mode updates existing user and fee submission studentName", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id, { name: "A Block" });
    const mess = await createTestMess(college._id, { name: "Central Mess" });
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id, {
      email: "upsert@test.edu",
      rollNo: "307",
      name: "Old Name",
      messId: mess._id,
    });

    await FeeSubmission.create({
      studentId: student._id,
      studentName: "Old Name",
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "documentNotSubmitted" },
      messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(
        payload(
          [
            studentRow({
              email: "upsert@test.edu",
              rollNo: "307",
              name: "New Name",
              roomNo: "22",
            }),
          ],
          "upsert"
        )
      );

    expect(res.status).toBe(200);
    expect(res.body.results.updated).toHaveLength(1);

    const updated = await User.findById(student._id);
    const fee = await FeeSubmission.findOne({ studentId: student._id });
    expect(updated.name).toBe("New Name");
    expect(updated.roomNo).toBe("22");
    expect(fee.studentName).toBe("New Name");
  });

  it("upsert mode errors when roll number conflicts with another user", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id, { name: "A Block" });
    await createTestMess(college._id, { name: "Central Mess" });
    const admin = await createTestAdmin(college._id);

    await createTestStudent(college._id, hostel._id, {
      email: "first@test.edu",
      rollNo: "308",
      roomNo: "13",
    });
    await createTestStudent(college._id, hostel._id, {
      email: "second@test.edu",
      rollNo: "309",
      roomNo: "14",
    });

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(payload([studentRow({ email: "first@test.edu", rollNo: "309" })], "upsert"));

    expect(res.status).toBe(200);
    expect(res.body.results.errors).toHaveLength(1);
    expect(res.body.results.errors[0].reason).toMatch(/already assigned/i);
  });

  it("creates a new user and fee submission in create mode", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id, { name: "A Block" });
    await createTestMess(college._id, { name: "Central Mess" });
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(payload([studentRow({ email: "brandnew@test.edu", rollNo: "310", name: "Brand New" })]));

    expect(res.status).toBe(200);
    expect(res.body.results.created).toHaveLength(1);

    const created = await User.findOne({ email: "brandnew@test.edu" });
    const fee = await FeeSubmission.findOne({ studentId: created._id });
    expect(created).toBeTruthy();
    expect(fee).toBeTruthy();
  });

  it("handles duplicate key and generic create errors per row", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id, { name: "A Block" });
    await createTestMess(college._id, { name: "Central Mess" });
    const admin = await createTestAdmin(college._id);

    const createSpy = jest
      .spyOn(User, "create")
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }))
      .mockRejectedValueOnce(new Error("unexpected create failure"));

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(
        payload([
          studentRow({ email: "dup1@test.edu", rollNo: "311" }),
          studentRow({ email: "err1@test.edu", rollNo: "312" }),
        ])
      );

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.body.results.skipped).toHaveLength(1);
    expect(res.body.results.errors).toHaveLength(1);
  });

  it("returns 500 when top-level bulk upload handler throws", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const collegeSpy = jest.spyOn(College, "findById").mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .post("/api/user/bulk-upload")
      .set("Cookie", [authCookieFor(admin._id)])
      .send(payload([studentRow()]));

    expect(collegeSpy).toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
