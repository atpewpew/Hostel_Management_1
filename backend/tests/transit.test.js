import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
import Transit from "../models/transit.model.js";
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

describe("Transit API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- POST /api/transit ---

  it("student can create first EXIT entry → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        purpose: "Going home for weekend",
        transitStatus: "EXIT",
        date: new Date().toISOString(),
        time: "10:00:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transit.transitStatus).toBe("EXIT");
  });

  it("rejects first ENTRY without prior EXIT → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        transitStatus: "ENTRY",
        date: new Date().toISOString(),
        time: "10:00:00",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/first transit record must be EXIT/i);
  });

  it("rejects wrong sequence → EXIT after EXIT gives 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    // First EXIT
    await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "First exit",
      transitStatus: "EXIT",
      date: new Date(),
      time: "09:00:00",
    });

    // Second EXIT should fail
    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        purpose: "Another exit",
        transitStatus: "EXIT",
        date: new Date().toISOString(),
        time: "10:00:00",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ENTRY/i);
  });

  it("student can create ENTRY after EXIT → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    // First EXIT
    await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "Going out",
      transitStatus: "EXIT",
      date: new Date("2025-01-01"),
      time: "09:00:00",
    });

    // ENTRY after EXIT
    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        purpose: "Coming back",
        transitStatus: "ENTRY",
        date: "2025-01-01",
        time: "18:00:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.transit.transitStatus).toBe("ENTRY");
  });

  it("copies purpose from previous EXIT when creating ENTRY → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "Going out for errands",
      transitStatus: "EXIT",
      date: new Date("2025-01-02"),
      time: "09:00:00",
    });

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        transitStatus: "ENTRY",
        date: "2025-01-02",
        time: "18:00:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.transit.transitStatus).toBe("ENTRY");
    expect(res.body.transit.purpose).toBe("Going out for errands");
  });

  it("ignores client purpose for ENTRY and keeps previous EXIT purpose → 201", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "Medical appointment",
      transitStatus: "EXIT",
      date: new Date("2025-01-03"),
      time: "09:00:00",
    });

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        purpose: "Some different entry reason",
        transitStatus: "ENTRY",
        date: "2025-01-03",
        time: "18:00:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.transit.transitStatus).toBe("ENTRY");
    expect(res.body.transit.purpose).toBe("Medical appointment");
  });

  it("rejects transit with time before last record → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "Exit",
      transitStatus: "EXIT",
      date: new Date("2025-06-15"),
      time: "14:00:00",
    });

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        purpose: "Entry",
        transitStatus: "ENTRY",
        date: "2025-06-15",
        time: "10:00:00", // before 14:00:00
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/after/i);
  });

  it("rejects invalid purpose (too short) → 400", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/transit")
      .set("Cookie", [authCookieFor(student._id)])
      .send({ purpose: "ab", transitStatus: "EXIT", date: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  // --- GET /api/transit ---

  it("student lists only own transit entries → 200, filtered", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);
    const other = await createTestStudent(college._id, hostel._id, {
      email: "other@test.edu",
      rollNo: "202",
      roomNo: "12",
    });

    await Transit.create({
      studentId: student._id, collegeId: college._id,
      purpose: "Mine", transitStatus: "EXIT", date: new Date(), time: "10:00:00",
    });
    await Transit.create({
      studentId: other._id, collegeId: college._id,
      purpose: "Theirs", transitStatus: "EXIT", date: new Date(), time: "10:00:00",
    });

    const res = await request(app)
      .get("/api/transit")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.transitEntries).toHaveLength(1);
  });

  it("warden lists hostel students' transit → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const warden = await createTestWarden(college._id, hostel._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Transit.create({
      studentId: student._id, collegeId: college._id,
      purpose: "Student exit", transitStatus: "EXIT", date: new Date(), time: "10:00:00",
    });

    const res = await request(app)
      .get("/api/transit")
      .set("Cookie", [authCookieFor(warden._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transitEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("admin lists all transit entries for college → 200", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const admin = await createTestAdmin(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    await Transit.create({
      studentId: student._id, collegeId: college._id,
      purpose: "Admin view", transitStatus: "EXIT", date: new Date(), time: "10:00:00",
    });

    const res = await request(app)
      .get("/api/transit")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.transitEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("applies default time when creating transit directly without time", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const doc = await Transit.create({
      studentId: student._id,
      collegeId: college._id,
      purpose: "Default time check",
      transitStatus: "EXIT",
      date: new Date(),
    });

    expect(doc.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
