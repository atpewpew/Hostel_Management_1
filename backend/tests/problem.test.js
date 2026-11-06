import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import mongoose from "mongoose";
import { app } from "../index.js";
import Problem from "../models/problem.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestStudent,
  createTestWarden,
} from "./testUtils.js";

describe("Problem API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("requires problem image for create endpoint", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/problem")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        problemTitle: "Water leak",
        problemDescription: "Pipe leaking in room",
        category: "Plumbing",
        hostelId: hostel._id.toString(),
        roomNo: "10",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/image is required/i);
  });

  it("lists only in-scope student problems", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const otherStudent = await createTestStudent(college._id, hostel._id, {
      email: "other@test.edu",
      rollNo: "202",
      roomNo: "12",
    });

    await Problem.create({
      problemTitle: "Internet down",
      problemDescription: "No wifi",
      problemImage: "https://example.com/img1.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Internet",
      studentId: student._id,
    });
    await Problem.create({
      problemTitle: "Fan issue",
      problemDescription: "Fan not working",
      problemImage: "https://example.com/img2.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "12",
      category: "Electrical",
      studentId: otherStudent._id,
    });

    const res = await request(app)
      .get("/api/problem")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(res.body.problems[0].roomNo).toBe("10");
  });

  it("warden can update problem status", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Broken window",
      problemDescription: "Glass cracked",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Carpentry",
      studentId: student._id,
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.problem.status).toBe("Resolved");
  });

  it("warden cannot update status of problem in another hostel", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const otherHostel = await createTestHostel(college._id, { name: "B Block" });
    const student = await createTestStudent(college._id, hostel._id);
    const warden = await createTestWarden(college._id, otherHostel._id, {
      email: "warden2@test.edu",
    });

    const problem = await Problem.create({
      problemTitle: "Leaky pipe",
      problemDescription: "Water dripping",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Plumbing",
      studentId: student._id,
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "Resolved" });

    expect(res.status).toBe(403);
  });

  it("rejects invalid problem status value", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);
    const student = await createTestStudent(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Noisy fan",
      problemDescription: "Makes noise",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Electrical",
      studentId: student._id,
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "InvalidStatus" });

    expect(res.status).toBe(400);
  });

  it("student can add comment to own problem", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Flickering light",
      problemDescription: "Light flickers at night",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Electrical",
      studentId: student._id,
    });

    const res = await request(app)
      .post(`/api/problem/${problem._id}/comments`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ message: "Still not fixed after two days" });

    expect(res.status).toBe(201);
    expect(res.body.problem.comments).toHaveLength(1);
    expect(res.body.problem.comments[0].message).toBe("Still not fixed after two days");
  });

  it("returns 404 when adding comment to non-existent problem", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/problem/${fakeId}/comments`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ message: "Hello?" });

    expect(res.status).toBe(404);
  });

  it("student can verify problem resolution", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Broken door",
      problemDescription: "Lock jammed",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Carpentry",
      studentId: student._id,
      status: "ToBeConfirmed",
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/verify`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ studentStatus: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.problem.studentStatus).toBe("Resolved");
    expect(res.body.problem.status).toBe("Resolved");
  });

  it("student cannot verify another student's problem", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const otherStudent = await createTestStudent(college._id, hostel._id, {
      email: "other@test.edu",
      rollNo: "202",
      roomNo: "12",
    });

    const problem = await Problem.create({
      problemTitle: "Broken door",
      problemDescription: "Lock jammed",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Carpentry",
      studentId: student._id,
      status: "ToBeConfirmed",
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/verify`)
      .set("Cookie", [authCookieFor(otherStudent._id)])
      .send({ studentStatus: "Resolved" });

    expect(res.status).toBe(403);
  });

  // --- Additional coverage: filters, status transitions, verify rejection ---

  it("lists problems filtered by status → 200, filtered", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Problem.create({
      problemTitle: "Pending issue",
      problemDescription: "Desc",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Internet",
      studentId: student._id,
      status: "Pending",
    });
    await Problem.create({
      problemTitle: "Resolved issue",
      problemDescription: "Desc resolved",
      problemImage: "https://example.com/img2.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Electrical",
      studentId: student._id,
      status: "Resolved",
    });

    const res = await request(app)
      .get("/api/problem?status=Pending")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(res.body.problems[0].status).toBe("Pending");
  });

  it("lists problems filtered by category → 200, filtered", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Problem.create({
      problemTitle: "Net down",
      problemDescription: "Wifi issue",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id,
      collegeId: college._id,
      roomNo: "10",
      category: "Internet",
      studentId: student._id,
    });

    const res = await request(app)
      .get("/api/problem?category=Internet")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(res.body.problems[0].category).toBe("Internet");
  });

  it("warden sees only their hostel problems → 200", async () => {
    const college = await createTestCollege();
    const hostelA = await createTestHostel(college._id, { name: "A Block" });
    const hostelB = await createTestHostel(college._id, { name: "B Block" });
    const warden = await createTestWarden(college._id, hostelA._id);
    const studentA = await createTestStudent(college._id, hostelA._id);
    const studentB = await createTestStudent(college._id, hostelB._id, {
      email: "sb@test.edu", rollNo: "303", roomNo: "20",
    });

    await Problem.create({
      problemTitle: "A problem", problemDescription: "In hostel A",
      problemImage: "https://example.com/a.jpg",
      hostelId: hostelA._id, collegeId: college._id, roomNo: "10",
      category: "Electrical", studentId: studentA._id,
    });
    await Problem.create({
      problemTitle: "B problem", problemDescription: "In hostel B",
      problemImage: "https://example.com/b.jpg",
      hostelId: hostelB._id, collegeId: college._id, roomNo: "20",
      category: "Plumbing", studentId: studentB._id,
    });

    const res = await request(app)
      .get("/api/problem")
      .set("Cookie", [authCookieFor(warden._id)]);

    expect(res.status).toBe(200);
    expect(res.body.problems.length).toBe(1);
    expect(res.body.problems[0].problemTitle).toBe("A problem");
  });

  it("warden can update status to ToBeConfirmed → resolvedAt set", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Pending fix", problemDescription: "Needs fix",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id, collegeId: college._id, roomNo: "10",
      category: "Plumbing", studentId: student._id,
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "ToBeConfirmed" });

    expect(res.status).toBe(200);
    expect(res.body.problem.status).toBe("ToBeConfirmed");
    expect(res.body.problem.resolvedAt).not.toBeNull();
  });

  it("setting status to Pending clears resolvedAt", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const warden = await createTestWarden(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Was resolved", problemDescription: "Reopened",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id, collegeId: college._id, roomNo: "10",
      category: "Electrical", studentId: student._id,
      status: "Resolved", resolvedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "Pending" });

    expect(res.status).toBe(200);
    expect(res.body.problem.status).toBe("Pending");
    expect(res.body.problem.resolvedAt).toBeNull();
  });

  it("returns 404 when updating status of non-existent problem", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .patch(`/api/problem/${fakeId}/status`)
      .set("Cookie", [authCookieFor(warden._id)])
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
  });

  it("student rejects resolution → status back to Pending, resolvedAt null", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Not fixed right", problemDescription: "Still broken",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id, collegeId: college._id, roomNo: "10",
      category: "Carpentry", studentId: student._id,
      status: "ToBeConfirmed", resolvedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/problem/${problem._id}/verify`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ studentStatus: "Rejected" });

    expect(res.status).toBe(200);
    expect(res.body.problem.status).toBe("Pending");
    expect(res.body.problem.studentStatus).toBe("Rejected");
    expect(res.body.problem.resolvedAt).toBeNull();
  });

  it("rejects empty comment message → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const problem = await Problem.create({
      problemTitle: "Test", problemDescription: "Desc",
      problemImage: "https://example.com/img.jpg",
      hostelId: hostel._id, collegeId: college._id, roomNo: "10",
      category: "Other", studentId: student._id,
    });

    const res = await request(app)
      .post(`/api/problem/${problem._id}/comments`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ message: "" });

    expect(res.status).toBe(400);
  });
});
