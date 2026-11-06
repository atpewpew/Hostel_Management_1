import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
import College from "../models/college.model.js";
import {
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
} from "./testUtils.js";

describe("College API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("registers college successfully", async () => {
    const res = await request(app).post("/api/college/register").send({
      collegeName: "New College",
      emailDomain: "@newcollege.edu",
      adminEmail: "admin@newcollege.edu",
      hostels: ["H1"],
      messes: ["M1"],
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.college.name).toBe("New College");
  });

  it("rejects duplicate email domain registration", async () => {
    await createTestCollege({ emailDomain: "@duplicate.edu", adminEmail: "admin@duplicate.edu" });

    const res = await request(app).post("/api/college/register").send({
      collegeName: "Another College",
      emailDomain: "@duplicate.edu",
      adminEmail: "other@duplicate.edu",
      hostels: ["H1"],
      messes: ["M1"],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects registration when admin email does not match domain", async () => {
    const res = await request(app).post("/api/college/register").send({
      collegeName: "Mismatch College",
      emailDomain: "@college.edu",
      adminEmail: "admin@otherdomain.com",
      hostels: ["H1"],
      messes: ["M1"],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects registration with missing required fields", async () => {
    const res = await request(app).post("/api/college/register").send({
      collegeName: "Incomplete College",
      emailDomain: "@incomplete.edu",
      adminEmail: "admin@incomplete.edu",
      hostels: [],
      messes: ["M1"],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns approved college list", async () => {
    await createTestCollege({ name: "Approved", emailDomain: "@approved.edu", adminEmail: "admin@approved.edu" });

    const res = await request(app).get("/api/college/list");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.colleges.length).toBe(1);
  });

  it("does not return pending colleges in list", async () => {
    await createTestCollege({ name: "Approved", emailDomain: "@approved.edu", adminEmail: "admin@approved.edu" });
    await College.create({
      name: "Pending College",
      emailDomain: "@pending.edu",
      adminEmail: "admin@pending.edu",
      status: "pending",
    });

    const res = await request(app).get("/api/college/list");
    expect(res.status).toBe(200);
    expect(res.body.colleges.every((c) => c.status === "approved")).toBe(true);
  });

  it("returns hostels for a college", async () => {
    const college = await createTestCollege();
    await createTestHostel(college._id, { name: "Block A" });
    await createTestHostel(college._id, { name: "Block B" });

    const res = await request(app).get(`/api/college/${college._id}/hostels`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.hostels.length).toBe(2);
  });
});
