import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { app } from "../index.js";
import LostFound from "../models/lostFound.model.js";
import {
  authCookieFor,
  clearTestDatabase,
  closeTestDatabase,
  connectTestDatabase,
  createTestCollege,
  createTestHostel,
  createTestStudent,
} from "./testUtils.js";

describe("Lost & Found API", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("lists empty feed for a new college", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const res = await request(app)
      .get("/api/lost-found")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("student can create a LOST item and view it in feed", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const createRes = await request(app)
      .post("/api/lost-found")
      .set("Cookie", [authCookieFor(student._id)])
      .send({
        title: "Lost Room Keys",
        description: "Set of 2 keys with a blue spiral keychain",
        type: "LOST",
        category: "Keys",
        location: "Between Mess Block and Library",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.title).toBe("Lost Room Keys");
    expect(createRes.body.data.type).toBe("LOST");
    expect(createRes.body.data.status).toBe("OPEN");

    const feedRes = await request(app)
      .get("/api/lost-found")
      .set("Cookie", [authCookieFor(student._id)]);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.length).toBe(1);
    expect(feedRes.body.data[0].title).toBe("Lost Room Keys");
  });

  it("another student can submit a claim for a FOUND item, and owner can accept it", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const finder = await createTestStudent(college._id, hostel._id);
    const owner = await createTestStudent(college._id, hostel._id);

    const foundItem = await LostFound.create({
      title: "Found Boat Earphones Case",
      description: "Black case found on table 4",
      type: "FOUND",
      category: "Electronics",
      location: "Mess B First Floor",
      collegeId: college._id,
      hostelId: hostel._id,
      reportedBy: finder._id,
      status: "OPEN",
    });

    // Owner submits claim
    const claimRes = await request(app)
      .post(`/api/lost-found/${foundItem._id}/claim`)
      .set("Cookie", [authCookieFor(owner._id)])
      .send({
        proofDescription: "It has a scratch on the top lid and my initials inside",
        contactNumber: "9876543210",
      });

    expect(claimRes.status).toBe(201);
    expect(claimRes.body.success).toBe(true);

    // Finder accepts claim
    const updatedItem = await LostFound.findById(foundItem._id);
    const claimId = updatedItem.claims[0]._id;

    const acceptRes = await request(app)
      .patch(`/api/lost-found/${foundItem._id}/claim/${claimId}`)
      .set("Cookie", [authCookieFor(finder._id)])
      .send({ action: "ACCEPT" });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe("CLAIMED");
    expect(acceptRes.body.data.claims[0].status).toBe("ACCEPTED");
  });

  it("prevents students from claiming their own posted items", async () => {
    const college = await createTestCollege();
    const hostel = await createTestHostel(college._id);
    const student = await createTestStudent(college._id, hostel._id);

    const item = await LostFound.create({
      title: "Found Umbrella",
      description: "Black umbrella left at gym",
      type: "FOUND",
      category: "Other",
      location: "Gymnasium",
      collegeId: college._id,
      reportedBy: student._id,
      status: "OPEN",
    });

    const res = await request(app)
      .post(`/api/lost-found/${item._id}/claim`)
      .set("Cookie", [authCookieFor(student._id)])
      .send({ proofDescription: "Self claim attempt" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

