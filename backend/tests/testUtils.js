import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import College from "../models/college.model.js";
import Hostel from "../models/hostel.model.js";
import User from "../models/user.model.js";
import Mess from "../models/mess.model.js";
import Notification from "../models/notification.model.js";

let mongoServer;

export async function connectTestDatabase() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function clearTestDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function closeTestDatabase() {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export function authCookieFor(userId) {
  const token = jwt.sign({ userID: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  return `jwt=${token}`;
}

// --- Factory helpers ---

export async function createTestCollege(overrides = {}) {
  return College.create({
    name: "Test College",
    emailDomain: "@test.edu",
    adminEmail: "admin@test.edu",
    status: "approved",
    ...overrides,
  });
}

export async function createTestHostel(collegeId, overrides = {}) {
  return Hostel.create({ name: "A Block", collegeId, ...overrides });
}

export async function createTestStudent(collegeId, hostelId, overrides = {}) {
  const password = await bcrypt.hash("password123", 1);
  return User.create({
    name: "Test Student",
    email: "student@test.edu",
    rollNo: "101",
    password,
    role: "student",
    hostelId,
    collegeId,
    roomNo: "10",
    ...overrides,
  });
}

export async function createTestAdmin(collegeId, overrides = {}) {
  const password = await bcrypt.hash("password123", 1);
  return User.create({
    name: "Test Admin",
    email: "collegeadmin@test.edu",
    password,
    role: "collegeAdmin",
    collegeId,
    ...overrides,
  });
}

export async function createTestWarden(collegeId, hostelId, overrides = {}) {
  const password = await bcrypt.hash("password123", 1);
  return User.create({
    name: "Test Warden",
    email: "warden@test.edu",
    password,
    role: "warden",
    hostelId,
    collegeId,
    ...overrides,
  });
}

export async function createTestManager(overrides = {}) {
  const password = await bcrypt.hash("password123", 1);
  return User.create({
    name: "Test Manager",
    email: "manager@hostelia.com",
    password,
    role: "manager",
    ...overrides,
  });
}

export async function createTestMess(collegeId, overrides = {}) {
  return Mess.create({ name: "Central Mess", collegeId, capacity: 200, ...overrides });
}

export async function createTestNotification(userId, collegeId, overrides = {}) {
  return Notification.create({
    userId,
    collegeId,
    type: "problem_created",
    title: "Test Notification",
    message: "This is a test notification",
    relatedEntityId: new mongoose.Types.ObjectId(),
    relatedEntityType: "problem",
    ...overrides,
  });
}
