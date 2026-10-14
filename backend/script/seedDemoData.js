import bcrypt from "bcrypt";
import College from "../models/college.model.js";
import Hostel from "../models/hostel.model.js";
import Mess from "../models/mess.model.js";
import User from "../models/user.model.js";
import Menu from "../models/menu.model.js";
import { logger } from "../middleware/logger.js";

export async function seedDemoDataIfEmpty() {
  try {
    const collegeCount = await College.countDocuments();
    if (collegeCount > 0) {
      return; // Already initialized
    }

    logger.info("Initializing demo database with sample campus and users...");

    // 1. Create Demo College
    const college = await College.create({
      name: "Hostelia Demo Institute",
      emailDomain: "@demo.edu",
      adminEmail: "admin@demo.edu",
      address: "Campus Square, Knowledge Park",
      status: "approved",
      subscriptionStatus: "active",
    });

    // 2. Create Hostels
    const aryabhatta = await Hostel.create({
      name: "Aryabhatta Hostel",
      collegeId: college._id,
      capacity: 120,
    });

    const bhaskara = await Hostel.create({
      name: "Bhaskara Hostel",
      collegeId: college._id,
      capacity: 150,
    });

    // 3. Create Messes
    const centralMess = await Mess.create({
      name: "Central Dining Hall",
      collegeId: college._id,
      capacity: 300,
    });

    // 4. Create Menus
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const day of days) {
      await Menu.create({
        day,
        messId: centralMess._id,
        collegeId: college._id,
        meals: {
          Breakfast: ["Idli & Sambar", "Chai / Coffee", "Bread Butter"],
          Lunch: ["Roti", "Dal Makhani", "Jeera Rice", "Paneer Gravy", "Salad"],
          Snacks: ["Samosa", "Tea"],
          Dinner: ["Roti", "Dal Fry", "Steamed Rice", "Mixed Veg", "Gulab Jamun"],
        },
      });
    }

    // 5. Create Users
    const defaultPassword = await bcrypt.hash("Password123", 10);

    // College Admin
    await User.create({
      name: "Campus Administrator",
      email: "admin@demo.edu",
      password: defaultPassword,
      role: "collegeAdmin",
      collegeId: college._id,
    });

    // Warden
    await User.create({
      name: "Prof. Sharma (Warden)",
      email: "warden@demo.edu",
      password: defaultPassword,
      role: "warden",
      collegeId: college._id,
      hostelId: aryabhatta._id,
    });

    // Student
    await User.create({
      name: "Rahul Verma",
      email: "student@demo.edu",
      password: defaultPassword,
      role: "student",
      rollNo: "101",
      collegeId: college._id,
      hostelId: aryabhatta._id,
      messId: centralMess._id,
      roomNo: "A-204",
    });

    // Platform Manager
    await User.create({
      name: "Platform SuperAdmin",
      email: "manager@hostelia.com",
      password: defaultPassword,
      role: "manager",
    });

    logger.info("Demo data created successfully!");
    console.log("\n================ DEMO ACCOUNTS CREATED ================");
    console.log("Campus: Hostelia Demo Institute (@demo.edu)");
    console.log("Password for all accounts: Password123\n");
    console.log("1. College Admin: admin@demo.edu");
    console.log("2. Warden:        warden@demo.edu");
    console.log("3. Student:       student@demo.edu");
    console.log("4. Manager:       manager@hostelia.com");
    console.log("=======================================================\n");
  } catch (error) {
    logger.error("Failed to seed demo data:", error);
  }
}
