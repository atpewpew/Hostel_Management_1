import { afterEach, describe, expect, it, jest } from "@jest/globals";

const bcrypt = { genSalt: jest.fn(), hash: jest.fn(), compare: jest.fn() };
const jwt = { sign: jest.fn() };
const logger = { info: jest.fn(), error: jest.fn() };
const FeeSubmission = { create: jest.fn() };
const OTP = { findOne: jest.fn(), findOneAndDelete: jest.fn(), create: jest.fn() };
const User = { findOne: jest.fn(), create: jest.fn(), findById: jest.fn() };
const sendEmail = jest.fn();
const getEmailUser = jest.fn(() => "noreply@test.edu");

await jest.unstable_mockModule("bcrypt", () => ({ default: bcrypt }));
await jest.unstable_mockModule("jsonwebtoken", () => ({ default: jwt }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ logger }));
await jest.unstable_mockModule("../models/feeSubmission.model.js", () => ({ default: FeeSubmission }));
await jest.unstable_mockModule("../models/otp.model.js", () => ({ default: OTP }));
await jest.unstable_mockModule("../models/user.model.js", () => ({ default: User }));
await jest.unstable_mockModule("../utils/email-client.js", () => ({ sendEmail, getEmailUser }));

const {
  generateToken,
  generateOTP,
  verifyOTP,
  signup,
  login,
  managerLogin,
  logout,
} = await import("../controllers/auth.controller.js");

function resMock() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    cookie: jest.fn(function cookie(name, value) {
      this.cookies.push([name, value]);
      return this;
    }),
    clearCookie: jest.fn(),
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

function chainableFindOne(result) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(result),
    then: (resolve) => Promise.resolve(result).then(resolve),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };
}

describe("auth.controller unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("generateToken sets jwt cookie", () => {
    jwt.sign.mockReturnValue("token123");
    const res = resMock();
    const token = generateToken("u1", res);
    expect(token).toBe("token123");
    expect(res.cookie).toHaveBeenCalledWith(
      "jwt",
      "token123",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("generateOTP covers validation/existing user/success/error", async () => {
    const req = {
      body: { email: "student@test.edu", collegeId: "c1", name: "Test", rollNo: "101" },
      college: { name: "Test College" },
    };
    const res = resMock();

    await generateOTP({ ...req, body: { email: "bad" } }, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce({ _id: "u1" });
    await generateOTP(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "u2" });
    await generateOTP(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    OTP.findOneAndDelete.mockResolvedValueOnce();
    OTP.create.mockResolvedValueOnce();
    sendEmail.mockResolvedValueOnce();
    await generateOTP(req, res);
    expect(res.statusCode).toBe(200);

    User.findOne.mockRejectedValueOnce(new Error("db"));
    await generateOTP(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("verifyOTP covers invalid/missing/wrong and success branches", async () => {
    const req = {
      body: {
        email: "student@test.edu",
        collegeId: "c1",
        otp: "123456",
        userData: {
          name: "Test User",
          rollNo: "101",
          hostelId: "507f1f77bcf86cd799439011",
          roomNo: "10",
          password: "password123",
        },
      },
      college: { _id: "c1" },
    };
    const res = resMock();

    await verifyOTP({ ...req, body: { email: "bad" } }, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue(null) });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ otp: "654321" }) });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ otp: "123456" }) });
    OTP.findOneAndDelete.mockResolvedValueOnce();
    User.findOne.mockResolvedValueOnce({ _id: "e1" });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ otp: "123456" }) });
    OTP.findOneAndDelete.mockResolvedValueOnce();
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "r1" });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ otp: "123456" }) });
    OTP.findOneAndDelete.mockResolvedValueOnce();
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    bcrypt.genSalt.mockResolvedValueOnce("salt");
    bcrypt.hash.mockResolvedValueOnce("hashed");
    User.create.mockResolvedValueOnce({
      _id: "n1",
      role: "student",
      email: "student@test.edu",
    });
    FeeSubmission.create.mockResolvedValueOnce();
    jwt.sign.mockReturnValue("t1");
    User.findById.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) =>
        Promise.resolve({
          _id: "n1",
          name: "Test User",
          email: "student@test.edu",
          role: "student",
          rollNo: "101",
          hostelId: { _id: "h1", name: "A Block" },
          messId: null,
          roomNo: "10",
          collegeId: { _id: "c1", name: "Test College" },
        }).then(resolve),
      catch: (reject) => Promise.resolve().catch(reject),
    });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(200);

    OTP.findOne.mockReturnValueOnce({ sort: jest.fn().mockResolvedValue({ otp: "123456" }) });
    OTP.findOneAndDelete.mockResolvedValueOnce();
    await verifyOTP({ ...req, body: { email: "student@test.edu", collegeId: "c1", otp: "123456" } }, res);
    expect(res.statusCode).toBe(200);

    OTP.findOne.mockImplementationOnce(() => {
      throw new Error("fatal");
    });
    await verifyOTP(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("signup covers validation/otp pending/duplicates/success/error", async () => {
    const req = {
      body: {
        name: "Test User",
        rollNo: "101",
        email: "student@test.edu",
        collegeId: "c1",
        hostelId: "h1",
        roomNo: "10",
        password: "password123",
      },
      college: { _id: "c1" },
    };
    const res = resMock();

    await signup({ ...req, body: { name: "" } }, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockResolvedValueOnce({ _id: "otp" });
    await signup(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockResolvedValueOnce(null);
    User.findOne.mockResolvedValueOnce({ _id: "u1" });
    await signup(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockResolvedValueOnce(null);
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "u2" });
    await signup(req, res);
    expect(res.statusCode).toBe(400);

    OTP.findOne.mockResolvedValueOnce(null);
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    bcrypt.genSalt.mockResolvedValueOnce("salt");
    bcrypt.hash.mockResolvedValueOnce("hash");
    User.create.mockResolvedValueOnce({
      _id: "n2",
      collegeId: { toString: () => "c1" },
      role: "student",
      email: "student@test.edu",
    });
    FeeSubmission.create.mockResolvedValueOnce();
    jwt.sign.mockReturnValue("t2");
    User.findById.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) =>
        Promise.resolve({
          _id: "n2",
          name: "Test User",
          email: "student@test.edu",
          role: "student",
          rollNo: "101",
          hostelId: { _id: "h1", name: "A Block" },
          messId: null,
          roomNo: "10",
          collegeId: { _id: "c1", name: "Test College" },
        }).then(resolve),
      catch: (reject) => Promise.resolve().catch(reject),
    });
    await signup(req, res);
    expect(res.statusCode).toBe(201);

    OTP.findOne.mockRejectedValueOnce(new Error("fatal"));
    await signup(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("login covers validation/not-found/pending/wrong-pass/success/error", async () => {
    const req = { body: { email: "student@test.edu", password: "password123", collegeId: "c1" } };
    const res = resMock();

    await login({ body: { email: "x", password: "", collegeId: "" } }, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockReturnValueOnce(chainableFindOne(null));
    await login(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockReturnValueOnce(
      chainableFindOne({
        _id: "u1",
        collegeId: { _id: "c1", name: "College", status: "pending" },
      })
    );
    await login(req, res);
    expect(res.statusCode).toBe(403);

    User.findOne.mockReturnValueOnce(
      chainableFindOne({
        _id: "u2",
        password: "hash",
        role: "student",
        collegeId: { _id: "c1", name: "College", status: "approved" },
      })
    );
    bcrypt.compare.mockResolvedValueOnce(false);
    await login(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockReturnValueOnce(
      chainableFindOne({
        _id: "u3",
        name: "User",
        rollNo: "101",
        email: "student@test.edu",
        password: "hash",
        hostelId: { _id: "h1", name: "A Block" },
        messId: null,
        roomNo: "10",
        role: "student",
        collegeId: { _id: "c1", name: "College", status: "approved" },
      })
    );
    bcrypt.compare.mockResolvedValueOnce(true);
    jwt.sign.mockReturnValue("token");
    await login(req, res);
    expect(res.statusCode).toBe(200);

    User.findOne.mockImplementationOnce(() => {
      throw new Error("fatal");
    });
    await login(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("managerLogin and logout cover happy/error branches", async () => {
    const req = { body: { email: "manager@test.edu", password: "password123" } };
    const res = resMock();

    await managerLogin({ body: { email: "bad", password: "" } }, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce(null);
    await managerLogin(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce({ _id: "m1", password: "hash", role: "manager" });
    bcrypt.compare.mockResolvedValueOnce(false);
    await managerLogin(req, res);
    expect(res.statusCode).toBe(400);

    User.findOne.mockResolvedValueOnce({
      _id: "m2",
      name: "Mgr",
      email: "manager@test.edu",
      password: "hash",
      role: "manager",
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    jwt.sign.mockReturnValue("t3");
    await managerLogin(req, res);
    expect(res.statusCode).toBe(200);

    User.findOne.mockRejectedValueOnce(new Error("fatal"));
    await managerLogin(req, res);
    expect(res.statusCode).toBe(500);

    const outRes = resMock();
    logout({}, outRes);
    expect(outRes.statusCode).toBe(200);
  });
});
