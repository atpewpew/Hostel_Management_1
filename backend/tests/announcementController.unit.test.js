import { afterEach, describe, expect, it, jest } from "@jest/globals";

const Announcement = {
  find: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
  findOne: jest.fn(),
};
const User = { find: jest.fn() };
const uploadBufferToCloudinary = jest.fn();
const getSecureUrl = jest.fn();
const notifyUsers = jest.fn();
const logger = { info: jest.fn(), error: jest.fn() };

await jest.unstable_mockModule("../models/announcement.model.js", () => ({ default: Announcement }));
await jest.unstable_mockModule("../models/user.model.js", () => ({ default: User }));
await jest.unstable_mockModule("../config/cloudinary.js", () => ({
  uploadBufferToCloudinary,
  getSecureUrl,
}));
await jest.unstable_mockModule("../utils/notificationService.js", () => ({ notifyUsers }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ logger }));

const {
  getAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  addAnnouncementComment,
} = await import("../controllers/announcement.controller.js");

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

describe("announcement.controller unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("covers getAnnouncement success and failure", async () => {
    const req = { user: { collegeId: "c1" } };
    const res = resMock();
    Announcement.find.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue([{ _id: "a1" }]) });
    await getAnnouncement(req, res);
    expect(res.statusCode).toBe(200);

    Announcement.find.mockImplementationOnce(() => {
      throw new Error("db fail");
    });
    await getAnnouncement(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("covers createAnnouncement validation/unauthorized/upload/create/error branches", async () => {
    const baseReq = {
      body: { title: "Title", message: "Message" },
      user: {
        _id: { toString: () => "u1" },
        collegeId: "c1",
        name: "Admin",
        email: "admin@test.edu",
        role: "collegeAdmin",
      },
    };
    const res = resMock();

    await createAnnouncement({ ...baseReq, body: { title: "", message: "" } }, res);
    expect(res.statusCode).toBe(400);

    await createAnnouncement({ ...baseReq, user: null }, res);
    expect(res.statusCode).toBe(401);

    uploadBufferToCloudinary.mockResolvedValueOnce({ secure_url: "https://f" });
    getSecureUrl.mockReturnValueOnce("https://f");
    Announcement.create.mockResolvedValueOnce({ _id: "a1" });
    User.find.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue([{ _id: { toString: () => "s1" } }]),
    });
    notifyUsers.mockResolvedValueOnce();
    await createAnnouncement(
      {
        ...baseReq,
        file: { buffer: Buffer.from("x"), mimetype: "application/pdf" },
      },
      res
    );
    expect(res.statusCode).toBe(201);

    Announcement.create.mockResolvedValueOnce({ _id: "a2" });
    User.find.mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });
    await createAnnouncement(baseReq, res);
    expect(res.statusCode).toBe(201);

    Announcement.create.mockResolvedValueOnce({ _id: "a3" });
    User.find.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue([{ _id: { toString: () => "s2" } }]),
    });
    notifyUsers.mockRejectedValueOnce(new Error("notify fail"));
    await createAnnouncement(baseReq, res);
    expect(res.statusCode).toBe(201);

    Announcement.create.mockRejectedValueOnce(new Error("create fail"));
    await createAnnouncement(baseReq, res);
    expect(res.statusCode).toBe(500);
  });

  it("covers deleteAnnouncement 404/200/500", async () => {
    const req = { params: { id: "a1" }, user: { collegeId: "c1" } };
    const res = resMock();

    Announcement.findOneAndDelete.mockResolvedValueOnce(null);
    await deleteAnnouncement(req, res);
    expect(res.statusCode).toBe(404);

    Announcement.findOneAndDelete.mockResolvedValueOnce({ _id: "a1" });
    await deleteAnnouncement(req, res);
    expect(res.statusCode).toBe(200);

    Announcement.findOneAndDelete.mockRejectedValueOnce(new Error("delete fail"));
    await deleteAnnouncement(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("covers addAnnouncementComment validation/404/success/500", async () => {
    const req = {
      params: { id: "a1" },
      body: { message: "hello" },
      user: { _id: { toString: () => "u1" }, role: "student", collegeId: "c1" },
    };
    const res = resMock();

    await addAnnouncementComment({ ...req, body: { message: "" } }, res);
    expect(res.statusCode).toBe(400);

    Announcement.findOne.mockResolvedValueOnce(null);
    await addAnnouncementComment(req, res);
    expect(res.statusCode).toBe(404);

    const doc = {
      _id: { toString: () => "a1" },
      comments: { push: jest.fn() },
      save: jest.fn().mockResolvedValue(),
    };
    Announcement.findOne.mockResolvedValueOnce(doc);
    await addAnnouncementComment(req, res);
    expect(res.statusCode).toBe(201);

    Announcement.findOne.mockRejectedValueOnce(new Error("comment fail"));
    await addAnnouncementComment(req, res);
    expect(res.statusCode).toBe(500);
  });
});
