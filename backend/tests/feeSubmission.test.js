import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock email before importing app (fee reminders send emails)
await jest.unstable_mockModule("../utils/email-client.js", () => ({
  sendEmail: jest.fn(async () => ({ messageId: "mock-id" })),
  getEmailUser: jest.fn(() => "test@hostelia.local"),
}));

const { app } = await import("../index.js");
import FeeSubmission from "../models/feeSubmission.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestStudent,
  createTestAdmin,
  createTestWarden,
} from "./testUtils.js";

describe("Fee Submission API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  async function seedFeeRecord(studentId, collegeId) {
    return FeeSubmission.create({
      studentId,
      studentName: "Test Student",
      studentEmail: "student@test.edu",
      collegeId,
      hostelFee: { status: "documentNotSubmitted" },
      messFee: { status: "documentNotSubmitted" },
    });
  }

  it("student can get their own fee status", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .get("/api/fee")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].hostelFee.status).toBe("documentNotSubmitted");
  });

  it("admin can get all fee statuses for the college", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student1 = await createTestStudent(college._id, hostel._id);
    const student2 = await createTestStudent(college._id, hostel._id, {
      email: "student2@test.edu",
      rollNo: "202",
      roomNo: "11",
    });

    await seedFeeRecord(student1._id, college._id);
    await seedFeeRecord(student2._id, college._id);

    const res = await request(app)
      .get("/api/fee")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it("hostel fee submission without file returns 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .post("/api/fee/hostel")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/document is required/i);
  });

  it("mess fee submission without file returns 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .post("/api/fee/mess")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/document is required/i);
  });

  it("warden cannot submit hostel fee (403)", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const res = await request(app)
      .post("/api/fee/hostel")
      .set("Cookie", [authCookieFor(warden._id)]);

    expect(res.status).toBe(403);
  });

  it("admin can update fee status for a student", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .patch(`/api/fee/${student._id}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ hostelFeeStatus: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hostelFee.status).toBe("approved");
  });

  it("rejects fee status update with no fields provided", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .patch(`/api/fee/${student._id}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when updating fee status for unknown student", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/fee/${fakeId}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ hostelFeeStatus: "approved" });

    expect(res.status).toBe(404);
  });

  it("student cannot update fee status (403)", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const otherStudent = await createTestStudent(college._id, hostel._id, {
      email: "other@test.edu",
      rollNo: "202",
      roomNo: "11",
    });
    await seedFeeRecord(otherStudent._id, college._id);

    const res = await request(app)
      .patch(`/api/fee/${otherStudent._id}/status`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ hostelFeeStatus: "approved" });

    expect(res.status).toBe(403);
  });

  // ===== Fee Reminder Tests =====

  it("admin can send single fee reminder → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    await seedFeeRecord(student._id, college._id);

    const res = await request(app)
      .post("/api/fee/email/reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentId: student._id.toString(),
        emailType: "hostelFee",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects reminder with missing studentId → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/fee/email/reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ emailType: "both" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown student reminder", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/fee/email/reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentId: fakeId.toString(),
        emailType: "hostelFee",
      });

    expect(res.status).toBe(404);
  });

  it("admin can send bulk fee reminders → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student1 = await createTestStudent(college._id, hostel._id);
    const student2 = await createTestStudent(college._id, hostel._id, {
      email: "s2@test.edu",
      rollNo: "302",
      roomNo: "15",
    });

    const res = await request(app)
      .post("/api/fee/email/bulk-reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentIds: [student1._id.toString(), student2._id.toString()],
        emailType: "both",
        notes: "Please pay by end of month",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.success.length).toBe(2);
  });

  it("rejects bulk with empty studentIds array → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/fee/email/bulk-reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ studentIds: [], emailType: "hostelFee" });

    expect(res.status).toBe(400);
  });

  // --- Additional coverage: updateFeeStatus, warden scope, more reminder types ---

  it("admin can update hostel fee status → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await FeeSubmission.create({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "pending" },
      messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .patch(`/api/fee/${student._id}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ hostelFeeStatus: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hostelFee.status).toBe("approved");
  });

  it("admin can update both fee statuses at once → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await FeeSubmission.create({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "pending" },
      messFee: { status: "pending" },
    });

    const res = await request(app)
      .patch(`/api/fee/${student._id}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ hostelFeeStatus: "approved", messFeeStatus: "rejected" });

    expect(res.status).toBe(200);
    expect(res.body.data.hostelFee.status).toBe("approved");
    expect(res.body.data.messFee.status).toBe("rejected");
  });

  it("rejects fee status update with no fields → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await FeeSubmission.create({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "pending" },
      messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .patch(`/api/fee/${student._id}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 404 when updating fee for non-existent student → 404", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/fee/${fakeId}/status`)
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ hostelFeeStatus: "approved" });

    expect(res.status).toBe(404);
  });

  it("admin can send messFee reminder → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await FeeSubmission.create({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "documentNotSubmitted" },
      messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .post("/api/fee/email/reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentId: student._id.toString(),
        emailType: "messFee",
        notes: "Please pay mess fee",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("admin can send 'both' type reminder → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await FeeSubmission.create({
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      collegeId: college._id,
      hostelFee: { status: "documentNotSubmitted" },
      messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .post("/api/fee/email/reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentId: student._id.toString(),
        emailType: "both",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("bulk reminder returns 404 when no students found", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/fee/email/bulk-reminder")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({
        studentIds: [fakeId.toString()],
        emailType: "hostelFee",
      });

    expect(res.status).toBe(404);
  });

  it("warden-scoped fee view returns only their hostel students → 200", async () => {
    const college = await createTestCollege();
    const hostelA = await createTestHostel(college._id, { name: "A Block" });
    const hostelB = await createTestHostel(college._id, { name: "B Block" });
    const warden = await createTestWarden(college._id, hostelA._id);
    const studentA = await createTestStudent(college._id, hostelA._id);
    const studentB = await createTestStudent(college._id, hostelB._id, {
      email: "sb@test.edu", rollNo: "303", roomNo: "20",
    });

    await FeeSubmission.create({
      studentId: studentA._id, studentName: "A", studentEmail: "a@test.edu",
      collegeId: college._id,
      hostelFee: { status: "pending" }, messFee: { status: "documentNotSubmitted" },
    });
    await FeeSubmission.create({
      studentId: studentB._id, studentName: "B", studentEmail: "b@test.edu",
      collegeId: college._id,
      hostelFee: { status: "pending" }, messFee: { status: "documentNotSubmitted" },
    });

    const res = await request(app)
      .get("/api/fee")
      .set("Cookie", [authCookieFor(warden._id)]);

    expect(res.status).toBe(200);
    // Warden should only see fee submissions for their hostel's students
    expect(res.body.data.length).toBe(1);
  });
});
