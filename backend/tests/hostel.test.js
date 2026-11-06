import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
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

describe("Hostel API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- POST /api/hostel/create ---

  it("admin can create a new hostel → 201, hostel returned", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/hostel/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "C Block" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.hostel.name).toBe("C Block");
  });

  it("rejects hostel with empty name → 400, validation failed", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);

    const res = await request(app)
      .post("/api/hostel/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects duplicate hostel name in same college → 400", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    await createTestHostel(college._id, { name: "A Block" });

    const res = await request(app)
      .post("/api/hostel/create")
      .set("Cookie", [authCookieFor(admin._id)])
      .send({ name: "A Block" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("student cannot create hostel → 403", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .post("/api/hostel/create")
      .set("Cookie", [authCookieFor(student._id)])
      .send({ name: "X Block" });

    expect(res.status).toBe(403);
  });

  // --- GET /api/hostel/list ---

  it("admin can list hostels with wardens → 200, array with wardens[]", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    const hostel = await createTestHostel(college._id, { name: "A Block" });
    await createTestWarden(college._id, hostel._id);

    const res = await request(app)
      .get("/api/hostel/list")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hostels.length).toBe(1);
    expect(res.body.hostels[0].wardens.length).toBe(1);
  });

  it("returns empty wardens array for hostel with no warden assigned", async () => {
    const college = await createTestCollege();
    const admin = await createTestAdmin(college._id);
    await createTestHostel(college._id, { name: "Empty Block" });

    const res = await request(app)
      .get("/api/hostel/list")
      .set("Cookie", [authCookieFor(admin._id)]);

    expect(res.status).toBe(200);
    expect(res.body.hostels[0].wardens).toEqual([]);
  });
});
