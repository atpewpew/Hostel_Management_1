import { afterEach, describe, expect, it, jest } from "@jest/globals";

const uploadBufferToCloudinary = jest.fn();
const getSecureUrl = jest.fn();
const logger = { info: jest.fn(), error: jest.fn() };
const isProblemInScope = jest.fn();
const scopedProblemsFilter = jest.fn();
const Problem = { create: jest.fn(), find: jest.fn(), findOne: jest.fn() };
const User = { find: jest.fn() };
const notifyUsers = jest.fn();

await jest.unstable_mockModule("../config/cloudinary.js", () => ({
  uploadBufferToCloudinary,
  getSecureUrl,
}));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ logger }));
await jest.unstable_mockModule("../middleware/roles.js", () => ({
  isProblemInScope,
  scopedProblemsFilter,
}));
await jest.unstable_mockModule("../models/problem.model.js", () => ({ default: Problem }));
await jest.unstable_mockModule("../models/user.model.js", () => ({ default: User }));
await jest.unstable_mockModule("../utils/notificationService.js", () => ({ notifyUsers }));

const {
  createProblem,
  listProblems,
  addProblemComment,
  updateProblemStatus,
  verifyProblemResolution,
} = await import("../controllers/problem.controller.js");

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

function chain(value) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function withPopulate(doc) {
  return {
    ...doc,
    populate: jest.fn().mockResolvedValue(doc),
  };
}

describe("problem.controller unit", () => {
  afterEach(() => jest.clearAllMocks());

  it("covers createProblem branches", async () => {
    const req = {
      body: {
        problemTitle: "Broken Fan",
        problemDescription: "Fan not working",
        category: "Electrical",
        hostelId: "507f1f77bcf86cd799439011",
        roomNo: "10",
      },
      user: { _id: "u1", collegeId: "c1" },
      file: { buffer: Buffer.from("x") },
    };
    const res = resMock();

    await createProblem({ ...req, body: { problemTitle: "" } }, res);
    expect(res.statusCode).toBe(400);

    await createProblem({ ...req, file: null }, res);
    expect(res.statusCode).toBe(400);

    uploadBufferToCloudinary.mockResolvedValueOnce({});
    getSecureUrl.mockReturnValueOnce("");
    await createProblem(req, res);
    expect(res.statusCode).toBe(502);

    uploadBufferToCloudinary.mockResolvedValueOnce({ secure_url: "x" });
    getSecureUrl.mockReturnValueOnce("https://img");
    Problem.create.mockResolvedValueOnce(withPopulate({ _id: "p1" }));
    User.find
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: { toString: () => "a1" } }]) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: { toString: () => "w1" } }]) });
    notifyUsers.mockResolvedValueOnce();
    await createProblem(req, res);
    expect(res.statusCode).toBe(201);

    uploadBufferToCloudinary.mockResolvedValueOnce({ secure_url: "x" });
    getSecureUrl.mockReturnValueOnce("https://img");
    Problem.create.mockResolvedValueOnce(withPopulate({ _id: "p2" }));
    User.find
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });
    await createProblem(req, res);
    expect(res.statusCode).toBe(201);

    uploadBufferToCloudinary.mockRejectedValueOnce(new Error("cloud fail"));
    await createProblem(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("covers listProblems and addProblemComment branches", async () => {
    const res = resMock();
    scopedProblemsFilter.mockReturnValue({ collegeId: "c1" });
    Problem.find.mockReturnValueOnce(
      chain([{ _id: "p1", hostelId: { _id: { toString: () => "h1" }, name: "A" } }])
    );
    await listProblems(
      { query: { query: " fan ", status: "Pending", category: "Electrical", hostelId: "h1" }, user: { role: "collegeAdmin" } },
      res
    );
    expect(res.statusCode).toBe(200);

    Problem.find.mockImplementationOnce(() => {
      throw new Error("db");
    });
    await listProblems({ query: {}, user: { role: "student" } }, res);
    expect(res.statusCode).toBe(500);

    const req = {
      params: { id: "p1" },
      body: { message: "please fix" },
      user: { _id: "u1", role: "student", collegeId: "c1" },
    };
    await addProblemComment({ ...req, body: { message: "" } }, res);
    expect(res.statusCode).toBe(400);

    Problem.findOne.mockResolvedValueOnce(null);
    await addProblemComment(req, res);
    expect(res.statusCode).toBe(404);

    const doc = withPopulate({
      _id: { toString: () => "p1" },
      comments: { push: jest.fn() },
      save: jest.fn().mockResolvedValue(),
    });
    isProblemInScope.mockReturnValueOnce(false);
    Problem.findOne.mockResolvedValueOnce(doc);
    await addProblemComment(req, res);
    expect(res.statusCode).toBe(403);

    isProblemInScope.mockReturnValueOnce(true);
    Problem.findOne.mockResolvedValueOnce(doc);
    await addProblemComment(req, res);
    expect(res.statusCode).toBe(201);
  });

  it("covers updateProblemStatus and verifyProblemResolution branches", async () => {
    const res = resMock();
    const req = { params: { id: "p1" }, body: { status: "Resolved" }, user: { _id: "u1", role: "warden", collegeId: "c1", hostelId: "h1" } };

    await updateProblemStatus({ ...req, body: { status: "Bad" } }, res);
    expect(res.statusCode).toBe(400);

    Problem.findOne.mockResolvedValueOnce(null);
    await updateProblemStatus(req, res);
    expect(res.statusCode).toBe(404);

    Problem.findOne.mockResolvedValueOnce({ hostelId: "h2" });
    await updateProblemStatus(req, res);
    expect(res.statusCode).toBe(403);

    const pdoc = withPopulate({
      _id: { toString: () => "p1" },
      problemTitle: "Broken Fan",
      studentId: { toString: () => "stu1" },
      hostelId: { toString: () => "h1" },
      save: jest.fn().mockResolvedValue(),
    });
    Problem.findOne.mockResolvedValueOnce(pdoc);
    notifyUsers.mockResolvedValueOnce();
    await updateProblemStatus(req, res);
    expect(res.statusCode).toBe(200);

    Problem.findOne.mockResolvedValueOnce(
      withPopulate({ ...pdoc, save: jest.fn().mockResolvedValue() })
    );
    notifyUsers.mockRejectedValueOnce(new Error("notif"));
    await updateProblemStatus({ ...req, body: { status: "Pending" } }, res);
    expect(res.statusCode).toBe(200);

    Problem.findOne.mockRejectedValueOnce(new Error("fatal"));
    await updateProblemStatus(req, res);
    expect(res.statusCode).toBe(500);

    const vreq = { params: { id: "p1" }, body: { studentStatus: "Resolved" }, user: { _id: "stu1", collegeId: "c1" } };
    await verifyProblemResolution({ ...vreq, body: { studentStatus: "Bad" } }, res);
    expect(res.statusCode).toBe(400);

    Problem.findOne.mockResolvedValueOnce(null);
    await verifyProblemResolution(vreq, res);
    expect(res.statusCode).toBe(404);

    Problem.findOne.mockResolvedValueOnce({ studentId: "other" });
    await verifyProblemResolution(vreq, res);
    expect(res.statusCode).toBe(403);

    const vdoc = withPopulate({
      _id: { toString: () => "p1" },
      studentId: "stu1",
      save: jest.fn().mockResolvedValue(),
    });
    Problem.findOne.mockResolvedValueOnce(vdoc);
    await verifyProblemResolution(vreq, res);
    expect(res.statusCode).toBe(200);

    Problem.findOne.mockResolvedValueOnce(
      withPopulate({ ...vdoc, save: jest.fn().mockResolvedValue() })
    );
    await verifyProblemResolution({ ...vreq, body: { studentStatus: "Rejected" } }, res);
    expect(res.statusCode).toBe(200);

    Problem.findOne.mockRejectedValueOnce(new Error("fatal"));
    await verifyProblemResolution(vreq, res);
    expect(res.statusCode).toBe(500);
  });
});
