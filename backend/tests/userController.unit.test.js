import { afterEach, describe, expect, it, jest } from "@jest/globals";

const User = {
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  startSession: jest.fn(),
  deleteOne: jest.fn(),
};
const Problem = { deleteMany: jest.fn(), updateMany: jest.fn() };
const Feedback = { deleteMany: jest.fn() };
const Announcement = { deleteMany: jest.fn(), updateMany: jest.fn() };
const Transit = { deleteMany: jest.fn() };
const Notification = { deleteMany: jest.fn() };
const FeeSubmission = { deleteOne: jest.fn(), updateOne: jest.fn() };
const sendEmail = jest.fn();
const getEmailUser = jest.fn(() => "noreply@test.edu");
const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

await jest.unstable_mockModule("../models/user.model.js", () => ({ default: User }));
await jest.unstable_mockModule("../models/problem.model.js", () => ({ default: Problem }));
await jest.unstable_mockModule("../models/feedback.model.js", () => ({ default: Feedback }));
await jest.unstable_mockModule("../models/announcement.model.js", () => ({ default: Announcement }));
await jest.unstable_mockModule("../models/transit.model.js", () => ({ default: Transit }));
await jest.unstable_mockModule("../models/notification.model.js", () => ({ default: Notification }));
await jest.unstable_mockModule("../models/feeSubmission.model.js", () => ({ default: FeeSubmission }));
await jest.unstable_mockModule("../utils/email-client.js", () => ({ sendEmail, getEmailUser }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ logger }));

const {
  getUserById,
  getAllStudents,
  getAllWardens,
  getUserName,
  updateUserDetails,
  deleteUser,
} = await import("../controllers/user.controller.js");

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };
}

function chainable(value) {
  return {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(value),
    then: (resolve) => Promise.resolve(value).then(resolve),
    catch: (reject) => Promise.resolve(value).catch(reject),
  };
}

describe("user.controller unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("covers getUserById success and errors", async () => {
    const req = { params: { userId: "507f1f77bcf86cd799439011" }, user: { _id: "u1", role: "collegeAdmin" } };
    const res = resMock();
    User.findById.mockReturnValueOnce(
      chainable({
        _id: "u1",
        name: "User",
        email: "u@test.edu",
        role: "student",
        rollNo: "101",
        hostelId: { _id: "h1", name: "A" },
        messId: null,
        roomNo: "10",
        collegeId: { _id: "c1", name: "C" },
      })
    );
    await getUserById(req, res);
    expect(res.statusCode).toBe(200);

    await getUserById({ ...req, params: { userId: "bad" } }, res);
    expect(res.statusCode).toBe(400);

    await getUserById({ ...req, user: { _id: "u2", role: "student" } }, res);
    expect(res.statusCode).toBe(403);

    User.findById.mockReturnValueOnce(chainable(null));
    await getUserById(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("covers getAllStudents, getAllWardens, getUserName", async () => {
    const res = resMock();
    User.find.mockReturnValueOnce(chainable([{ _id: "s1", name: "S", email: "s@test.edu", role: "student" }]));
    await getAllStudents({ user: { role: "collegeAdmin", collegeId: "c1" } }, res);
    expect(res.statusCode).toBe(200);

    await getAllStudents({ user: { role: "warden", collegeId: "c1" } }, res);
    expect(res.statusCode).toBe(400);

    User.find.mockReturnValueOnce(chainable([{ _id: "w1", name: "W", email: "w@test.edu", role: "warden" }]));
    await getAllWardens({ user: { role: "collegeAdmin", collegeId: "c1" } }, res);
    expect(res.statusCode).toBe(200);

    User.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ name: "N", role: "student" }) });
    await getUserName({ params: { userId: "507f1f77bcf86cd799439011" } }, res);
    expect(res.statusCode).toBe(200);

    await getUserName({ params: { userId: "bad" } }, res);
    expect(res.statusCode).toBe(400);

    User.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) });
    await getUserName({ params: { userId: "507f1f77bcf86cd799439011" } }, res);
    expect(res.statusCode).toBe(404);
  });

  it("covers updateUserDetails success, duplicate, and failures", async () => {
    const req = {
      params: { userId: "507f1f77bcf86cd799439011" },
      user: { _id: "admin1" },
      body: { name: "Updated", email: "u2@test.edu" },
    };
    const res = resMock();

    User.findByIdAndUpdate.mockReturnValueOnce(
      chainable({
        _id: "u1",
        name: "Updated",
        email: "u2@test.edu",
        role: "student",
        rollNo: "101",
        hostelId: { _id: "h1", name: "A" },
        messId: null,
        roomNo: "10",
      })
    );
    FeeSubmission.updateOne.mockResolvedValueOnce();
    await updateUserDetails(req, res);
    expect(res.statusCode).toBe(200);

    User.findByIdAndUpdate.mockReturnValueOnce(chainable(null));
    await updateUserDetails(req, res);
    expect(res.statusCode).toBe(404);

    await updateUserDetails({ ...req, params: { userId: "bad" } }, res);
    expect(res.statusCode).toBe(400);

    await updateUserDetails({ ...req, body: {} }, res);
    expect(res.statusCode).toBe(400);

    User.findByIdAndUpdate.mockImplementationOnce(() => {
      throw Object.assign(new Error("dup"), { code: 11000, keyPattern: { email: 1 } });
    });
    await updateUserDetails(req, res);
    expect(res.statusCode).toBe(409);
  });

  it("covers deleteUser success, not-found and error path", async () => {
    const req = {
      params: { userId: "507f1f77bcf86cd799439011" },
      user: { _id: "admin1", name: "Admin" },
    };
    const res = resMock();
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    User.startSession.mockResolvedValue(session);
    User.findById.mockReturnValueOnce({
      session: jest.fn().mockResolvedValue({
        name: "User",
        email: "u@test.edu",
        role: "student",
      }),
    });
    Problem.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Feedback.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Transit.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Notification.deleteMany.mockResolvedValue({ deletedCount: 1 });
    FeeSubmission.deleteOne.mockResolvedValue({ deletedCount: 1 });
    Announcement.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Problem.updateMany.mockResolvedValue({ modifiedCount: 1 });
    Announcement.updateMany.mockResolvedValue({ modifiedCount: 1 });
    User.deleteOne.mockResolvedValue({ deletedCount: 1 });
    sendEmail.mockResolvedValueOnce();

    await deleteUser(req, res);
    expect(res.statusCode).toBe(200);

    User.startSession.mockResolvedValueOnce(session);
    User.findById.mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null) });
    await deleteUser(req, res);
    expect(res.statusCode).toBe(404);

    await deleteUser({ ...req, params: { userId: "bad" } }, res);
    expect(res.statusCode).toBe(400);
  });
});
