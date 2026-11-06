import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

// Mock email before importing app
await jest.unstable_mockModule("../utils/email-client.js", () => ({
  sendEmail: jest.fn(async () => ({ messageId: "mock-id" })),
  getEmailUser: jest.fn(() => "test@hostelia.local"),
}));

const { app } = await import("../index.js");
import {
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestAdmin,
} from "./testUtils.js";

describe("Contact API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // --- POST /api/contact ---

  it("submits valid contact message → 200, success: true", async () => {
    // Seed an admin so the controller has someone to notify
    const college = await createTestCollege();
    await createTestAdmin(college._id);

    const res = await request(app).post("/api/contact").send({
      name: "John Doe",
      email: "john@test.edu",
      subject: "Help Request",
      message: "I need information about hostel registration",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects contact with missing name → 400, validation error", async () => {
    const res = await request(app).post("/api/contact").send({
      email: "john@test.edu",
      message: "Hello",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects contact with invalid email → 400, validation error", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "John Doe",
      email: "not-an-email",
      message: "Hello",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects contact with empty message → 400, validation error", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "John Doe",
      email: "john@test.edu",
      message: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
