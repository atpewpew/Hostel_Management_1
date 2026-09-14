const buffer = require('buffer');
if (!buffer.SlowBuffer) {
    buffer.SlowBuffer = buffer.Buffer;
}

const express = require('express');
const app = express();
require('dotenv').config();
const path = require('path');
const moment = require('moment');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const Transit = require('./models/transit');


const sequelize = require('./config/database.js');
const User = require('./models/user.js');
const hostelProblem = require('./models/problem.js');
const Announcement = require('./models/announcement.js'); // Import Announcement model
const { dataProblems, dataEntryExit, userData } = require('./config/data.js');
const { MenuItems, Feedback } = require('./models/menu.js');
const { parsePdfMenu } = require('./utils/pdfMenuParser.js');

//cloudinary 


//multer 
const multer = require("multer");

// Set storage engine
const storage = multer.diskStorage({
    destination: "./public/uploads/", // Store images in public/uploads/
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png/;
        const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeType = fileTypes.test(file.mimetype);

        if (mimeType && extName) {
            return cb(null, true);
        } else {
            cb(new Error("Images only!"));
        }
    }
});

// Configure express app
app.set('view engine', 'ejs');
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); // Needed for form submissions

moment().format();

sequelize.authenticate()
    .then(() => sequelize.sync()) // Sync models with database
    .then(() => console.log('Connected to SQLite in-memory database'))
    .catch(e => {
        console.error('Database connection error:', e);
        console.error('Error stack:', e.stack);
    });

// First, move the authMiddleware definition to the top after all the initial configurations
const authMiddleware = (req, res, next) => {
    const publicRoutes = ['/auth/login', '/auth/logout', '/signup', '/about', '/contact', '/', '/login'];
    if (!req.cookies.jwt && !publicRoutes.includes(req.path)) {
        return res.redirect('/login');
    }
    next();
};

// Public routes (no auth required)
app.get('/', (req, res) => {
    const isLoggedIn = Boolean(req.cookies.jwt);
    res.render('homepage.ejs', { loggedIn: isLoggedIn });
});

app.get('/about', (req, res) => {
    const isLoggedIn = Boolean(req.cookies.jwt);
    res.render('about.ejs', { loggedIn: isLoggedIn });
});

app.get('/contact', (req, res) => {
    const isLoggedIn = Boolean(req.cookies.jwt);
    res.render('contact.ejs', { loggedIn: isLoggedIn });
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

//routes for login and signup

const generateToken = (userID, res) => {

    const token = jwt.sign(
        { userID },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    )

    res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000, // in millisecond
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development"
    })

    return token;
}

//signup
const signup = async (req, res) => {
    try {
        console.log("Received signup request with data:", req.body);

        const { name, rollNo, email, hostel, roomNo, year, password } = req.body;

        // Validate required fields
        if (!name || !rollNo || !email || !hostel || !roomNo || !year || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Check for existing user
        const existingUser = await User.findOne({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        // Create new user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            rollNo,
            email,
            hostel,
            roomNo,
            year,
            password: hashedPassword,
            role: 'student'
        });

        // Generate token and set cookies
        generateToken(newUser.userId, res);
        res.cookie("userid", newUser.userId);
        res.cookie("role", newUser.role);

        return res.status(201).json({
            success: true,
            user: {
                userId: newUser.userId,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({
            success: false,
            message: "Error creating user",
            error: error.message
        });
    }
};

app.post("/auth/signup", signup);

//login
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const user2 = await User.findOne({ where: { email } });
        const user1 = userData.find(user => user.email === email);
        const user = user2 || user1;

        if (!user) {
            console.log("invalid user");
            return res.status(400).json({ message: "Invalid Credentials" });
        }
        if (!user1) {
            const isPasswordCorrect = await bcrypt.compare(password, user.password);

            if (!isPasswordCorrect) {
                console.log("incorrect password");
                return res.status(400).json({ message: "Invalid Credentials" });
            }
        }

        if (!user2) {
            if (user1.password !== password) {
                console.log("incorrect password");
                return res.status(400).json({ message: "Invalid Credentials" });
            }
        }


        generateToken(user.userId, res);

        console.log("user found");
        console.log(user);
        res.cookie("role", user.role)
        res.cookie("userid", user.userId)
        return res.status(200).json({
            userId: user.userId,
            name: user.name,
            rollNo: user.rollNo,
            email: user.email,
            hostel: user.hostel,
            roomNo: user.roomNo,
            year: user.year,
            role: user.role
        });

    } catch (error) {
        console.error("ERROR in log-in controller:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

app.post("/auth/login", login)

//logout
const logout = (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 })
        res.cookie("role", "", { maxAge: 0 })
        res.cookie("userid", "", { maxAge: 0 })
        res.clearCookie("jwt")
        res.clearCookie("role")
        res.clearCookie("userid")
        res.redirect('/');
    } catch (error) {
        console.log("ERROR in log-out controller", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

app.post("/auth/logout", logout)

// app.get('/services', async (req, res) => {
//     res.render('services.ejs');
// })


app.get("/services/announcements", authMiddleware, async (req, res) => {
    try {
        const isLoggedIn = Boolean(req.cookies.jwt);
        let announcements = await Announcement.findAll({ order: [["createdAt", "DESC"]] });
        const { role } = req.cookies;
        const dummyAnnouncements = [
            {
                title: "Wi-Fi Upgrade Notice",
                message: "Dear students, Wi-Fi bandwidth has been increased. If issues persist, contact hosteloffice@iiits.in.",
                createdAt: new Date()
            },
            {
                title: "Mess Menu Update",
                message: "The new mess menu for April has been updated. Check the notice board or website for details.",
                createdAt: new Date()
            },
            {
                title: "Exam Schedule Released",
                message: "The semester exam schedule has been released. Visit the portal to download the timetable.",
                createdAt: new Date()
            }
        ];

        announcements = [...announcements, ...dummyAnnouncements];

        res.render("announcements", { announcements, role, loggedIn: isLoggedIn });
    } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).send("Error fetching announcements");
    }
});


app.post("/services/announcement", async (req, res) => {
    const { title, message } = req.body;

    if (!title || !message) {
        return res.status(400).send("No title or message provided");
    }

    try {

        const newAnnouncement = await Announcement.create({
            title,
            message,
            date: new Date()
        });

        console.log("Announcement Created:", newAnnouncement);


        res.redirect("/services/announcements");

    } catch (error) {
        console.error("Error creating announcement:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.delete("/announcements/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await Announcement.destroy({ where: { id } });
        res.status(200).send("Deleted Successfully");
    } catch (error) {
        console.error("Error deleting announcement:", error);
        res.status(500).send("Failed to delete");
    }
});




app.get('/services/problems', authMiddleware, async (req, res) => {
    const isLoggedIn = Boolean(req.cookies.jwt);
    const role = req.cookies.role;
    const userID = req.cookies.userid;

    try {
        let user = await User.findOne({
            where: { userId: userID },
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            user = userData.find(u => userID === u.userId);
        }

        let userProblems1 = [];
        let userProblems2 = [];

        if (role !== 'admin') {
            userProblems1 = await hostelProblem.findAll({
                where: { hostel: user.hostel }
            });

            if (userProblems1.length > 0) {
                userProblems1 = userProblems1.map(problem => ({
                    ...problem.toJSON(),
                    roomNumber: problem.roomNo,
                    createdAt: problem.createdAt || new Date()
                }));
            }

            userProblems2 = dataProblems.filter(problem => user.hostel === problem.hostel)
                .map(problem => ({
                    ...problem,
                    createdAt: problem.createdAt || new Date()
                }));

        } else {
            userProblems1 = await hostelProblem.findAll();
            userProblems2 = dataProblems;
        }

        const problems = [...userProblems1, ...userProblems2];

        res.render('problems.ejs', { problems, role, userID, loggedIn: isLoggedIn, user });
    } catch (error) {
        console.error("Error fetching problems:", error);
        res.status(500).send("Error fetching problems");
    }
});

app.post("/services/problems/add", upload.single("problemImage"), async (req, res) => {
    try {
        const { problemTitle, problemDescription, roomNo, category, studentId, hostel } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: "Image upload is required" });
        }

        const problemImage = `/uploads/${req.file.filename}`; // Store image path relative to public folder

        console.log("Received data:", req.body);
        console.log("Uploaded file:", req.file);

        if (!problemTitle || !problemDescription || !problemImage || !studentId || !hostel || !roomNo || !category) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newProblem = {
            problemTitle,
            problemDescription,
            problemImage,
            studentId,
            hostel,
            roomNo,
            category,
            status: "Pending"
        };

        await hostelProblem.create(newProblem);
        console.log("Problem created:", newProblem);
        res.status(201).json(newProblem);
    } catch (error) {
        console.error("ERROR in creating problem:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

app.post('/services/problems/statusChange', async (req, res) => {
    const { problemId, status } = req.body;
    try {
        console.log("Received Data:", req.body);
        let problem2 = null;
        const problem1 = await hostelProblem.findOne({ where: { problemId: Number(problemId) } });
        if (!problem1) {
            problem2 = dataProblems.find(problem => problem.problemId === Number(problemId));
            if (!problem2) {
                return res.status(404).json({ message: "Problem not found" });
            }
        }
        if (!!problem1) {
            problem1.status = status;
            problem1.timeResolved = new Date();
            await problem1.save();
        } else if (!!problem2) {
            problem2.status = status; // Update status for the in-memory problem
            problem2.timeResolved = new Date();
        }
        res.status(200).json({ message: "Status updated successfully" });
    } catch (error) {
        console.error("ERROR in status change:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// res.render('problems.ejs', { problems });
app.get("/services/register", authMiddleware, async (req, res) => {
    try {
        const isLoggedIn = Boolean(req.cookies.jwt);
        const transitEntries = await Transit.findAll();

        console.log("Fetched Transit Entries:", transitEntries);
        const formattedEntries = transitEntries.map(entry => ({
            studentName: entry.studentName,
            studentHostel: entry.studentHostel,
            studentRoomNumber: entry.studentRoomNumber,
            studentRollNumber: entry.studentRollNumber,
            purpose: entry.purpose,
            transitStatus: entry.transitStatus,
            date: entry.createdAt.toISOString().split("T")[0], // Extract YYYY-MM-DD
            time: entry.createdAt.toISOString().split("T")[1].split(".")[0] // Extract HH:MM:SS
        }));
        const mergedData = [...dataEntryExit, ...formattedEntries];

        res.render("register.ejs", { entryExit: mergedData, loggedIn: isLoggedIn });

    } catch (error) {
        console.error("Error fetching transit data:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/services/transit', async (req, res) => {
    try {
        const { studentRollNumber, purpose, transitStatus, studentName, studentHostel, studentRoomNumber } = req.body;

        if (!studentRollNumber || !purpose || !transitStatus) {
            return res.status(400).send("All fields are required.");
        }

        await Transit.create({
            studentRollNumber,
            purpose,
            transitStatus,
            studentName,
            studentHostel,
            studentRoomNumber
        });

        res.redirect('/services/register'); // Redirect back to the transit page
    } catch (error) {
        console.error("Error adding transit entry:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/dashboard', authMiddleware, async (req, res) => {
    const isLoggedIn = Boolean(req.cookies.jwt);
    const role = req.cookies.role;
    const userId = req.cookies.userid;

    let userInfo = await User.findOne({ where: { userId: userId }, attributes: { exclude: ['password'] } });

    if (!userInfo) {
        userInfo = userData.find(user => userId === user.userId);
    }

    if (role === "student") {
        let userProblems1 = [];
        let userProblems2 = [];
        userProblems1 = await hostelProblem.findAll({
            where: { hostel: userInfo.hostel, studentId: userInfo.rollNo }
        });

        if (!!userProblems1) {
            userProblems1 = userProblems1.map(problem => ({
                ...problem.toJSON(),
                roomNumber: problem.roomNo // Change roomNo to roomNumber
            }));
        }

        userProblems2 = dataProblems.filter(problem => problem.studentId === userInfo.rollNo).map(problem => ({
            ...problem,
            createdAt: problem.createdAt || new Date()
        }));
        const problems = [...userProblems1, ...userProblems2];

        res.render('partials/dashboard/student.ejs', { userInfo, problems, loggedIn: isLoggedIn });

    } else if (role === "warden") {
        let userProblems1 = [];
        let userProblems2 = [];

        userProblems1 = await hostelProblem.findAll({
            where: { hostel: userInfo.hostel }
        });

        if (!!userProblems1) {
            userProblems1 = userProblems1.map(problem => ({
                ...problem.toJSON(),
                roomNumber: problem.roomNo // Change roomNo to roomNumber
            }));
        }

        userProblems2 = dataProblems.filter(problem => userInfo.hostel === problem.hostel);
        const problems = [...userProblems1, ...userProblems2];

        res.render('partials/dashboard/warden.ejs', { userInfo, problems, loggedIn: isLoggedIn });

    } else if (role === "admin") {

        // Get all users for admin dashboard
        let allUsers = await User.findAll({
            attributes: { exclude: ['password'] }
        });

        // Add mock users if needed
        if (userData && userData.length > 0) {
            // Filter out duplicates that might already exist in allUsers
            const existingUserIds = allUsers.map(user => user.userId);
            const uniqueMockUsers = userData.filter(user => !existingUserIds.includes(user.userId));

            // Combine real and mock users
            allUsers = [...allUsers, ...uniqueMockUsers];
        }

        let userProblems1 = await hostelProblem.findAll({
        });

        if (!!userProblems1) {
            userProblems1 = userProblems1.map(problem => ({
                ...problem.toJSON(),
                roomNumber: problem.roomNo // Change roomNo to roomNumber
            }));
        }

        let userProblems2 = dataProblems;
        let problems = [...userProblems1, ...userProblems2];

        res.render('partials/dashboard/admin.ejs', { userInfo, problems, allUsers, loggedIn: isLoggedIn });
    }
})

app.post('/services/users/add-warden', async (req, res) => {
    try {
        const { name, email, hostel, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const newWarden = await User.create({
            name,
            email,
            hostel,
            password: hashedPassword, // In production, make sure to hash the password
            role: 'warden'
        });

        res.status(201).json({ message: 'Warden added successfully', warden: newWarden });
    } catch (error) {
        console.error('Error adding warden:', error);
        res.status(500).json({ message: 'Error adding warden', error: error.message });
    }
});

// Delete Warden
app.delete('/services/users/delete-warden/:id', async (req, res) => {
    try {
        const wardenId = req.params.id;
        const deletedCount = await User.destroy({
            where: {
                userId: wardenId,
                role: 'warden'
            }
        });
        console.log(wardenId)
        // Find the warden in userData array if it exists
        const userToDelete = userData.find(user => user.userId === wardenId);

        if (userToDelete) {
            console.log(`Found warden to delete: ${userToDelete.name} (${userToDelete.email})`);
            userData = userData.filter(user => user.userId !== wardenId);
        } else {
            console.log(`Warden with ID ${wardenId} not found in userData array`);
        }
        if (!deletedCount) {
            // Fix the error by not reassigning to userData constant
            // Instead, modify the global userData variable if it exists
            if (typeof userData !== 'undefined') {
                // Filter the array without reassignment
                userData = userData.filter(user => user.userId !== wardenId);
            }
        }
        res.json({ message: 'Warden deleted successfully' });
    } catch (error) {
        console.error('Error deleting warden:', error);
        res.status(500).json({ message: 'Error deleting warden', error: error.message });
    }
});

const loadMenuData = require('./loadmenuData.js'); // Adjust the path

// Load menu data on startup
loadMenuData()
//menu

// Sync models with the database
sequelize.sync({ force: true })
    .then(() => {
        console.log('Database synced successfully!');
        return loadMenuData(); // Load menu data after syncing
    })
    .catch((error) => {
        console.error('Error syncing database:', error);
    });

// Admin-only middleware
const adminOnly = (req, res, next) => {
    const role = req.cookies.role;
    if (!req.cookies.jwt || role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Administrator privileges required." });
    }
    next();
};

// PDF Upload Storage for Mess Menu
const pdfUploadDir = path.join(__dirname, 'public/uploads/mess-menu');
const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pdfUploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'latest_menu.pdf');
    }
});
const uploadPdf = multer({
    storage: pdfStorage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';
        const isPdfMime = file.mimetype === 'application/pdf';
        if (isPdfExt || isPdfMime) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed!"));
        }
    }
});

// Mess Menu Routes
app.get('/services/mess', async (req, res) => {
    try {
        const isLoggedIn = Boolean(req.cookies.jwt);
        const role = req.cookies.role || null;
        const menuItems = await MenuItems.findAll({ order: [['id', 'ASC']] });

        let hasPdf = false;
        try {
            await fs.access(path.join(pdfUploadDir, 'latest_menu.pdf'));
            hasPdf = true;
        } catch (_) {
            hasPdf = false;
        }

        res.render('menu', {
            menuItems,
            query: req.query,
            loggedIn: isLoggedIn,
            role,
            hasPdf
        });
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Download latest uploaded mess menu PDF
app.get('/services/mess/download-pdf', async (req, res) => {
    try {
        const pdfPath = path.join(pdfUploadDir, 'latest_menu.pdf');
        await fs.access(pdfPath);
        res.download(pdfPath, 'Hostel_Mess_Weekly_Menu.pdf');
    } catch (err) {
        res.status(404).send('PDF menu not found.');
    }
});

// Parse uploaded PDF timetable and return structured preview
app.post('/services/mess/parse-pdf', adminOnly, (req, res) => {
    uploadPdf.single('menuPdf')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please select a PDF file to upload." });
        }

        try {
            const parsed = await parsePdfMenu(req.file.path);
            if (!parsed.items || parsed.items.length === 0) {
                return res.status(422).json({
                    success: false,
                    message: "No menu items could be recognized in the uploaded PDF. Please verify that the PDF contains a readable timetable."
                });
            }

            return res.status(200).json({
                success: true,
                items: parsed.items,
                summary: parsed.summary,
                filename: req.file.filename
            });
        } catch (parseError) {
            console.error("Error parsing menu PDF:", parseError);
            return res.status(500).json({
                success: false,
                message: "Error analyzing PDF: " + (parseError.message || "Unknown error")
            });
        }
    });
});

// Persist confirmed menu to database and menuData.json
app.post('/services/mess/update-menu', adminOnly, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Menu items array is required and cannot be empty." });
        }

        // Validate and clean each item
        const formattedItems = items.map(item => ({
            day: item.day,
            mealType: item.mealType,
            name: (item.name || '').trim(),
            alternateWeek: Boolean(item.alternateWeek),
            seasonal: Boolean(item.seasonal)
        })).filter(item => item.day && item.mealType && item.name);

        if (formattedItems.length === 0) {
            return res.status(400).json({ success: false, message: "No valid food items provided." });
        }

        // Update database table
        await MenuItems.destroy({ truncate: true });
        await MenuItems.bulkCreate(formattedItems);

        // Update menuData.json so it persists across restarts
        await fs.writeFile(
            path.join(__dirname, 'menuData.json'),
            JSON.stringify(formattedItems, null, 2),
            'utf-8'
        );

        return res.status(200).json({
            success: true,
            message: `Successfully published ${formattedItems.length} menu items!`,
            count: formattedItems.length
        });
    } catch (error) {
        console.error("Error saving updated menu:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update menu: " + error.message
        });
    }
});

const feedbackFilePath = path.join(__dirname, 'feedbackData.json');

app.post('/feedback', async (req, res) => {
    try {
        const { rating, comment, day, mealType } = req.body;
        const sanitizedComment = comment.replace(/[\r\n]+/g, ' ').trim();

        const newFeedback = {
            rating: rating || 'No rating provided',
            comment: sanitizedComment || 'No comment provided',
            day: day || 'Unknown day',
            mealType: mealType || 'Unknown meal type',
            createdAt: new Date().toISOString()
        };

        let feedbackData = [];
        try {
            const data = await fs.readFile(feedbackFilePath, 'utf-8');
            // Check if data is empty; if so, initialize as empty array
            feedbackData = data.trim() ? JSON.parse(data) : [];
        } catch (error) {
            // If the file doesn't exist, set feedbackData as empty array
            if (error.code !== 'ENOENT') {
                throw error;
            }
            feedbackData = [];
        }

        feedbackData.push(newFeedback);

        await fs.writeFile(feedbackFilePath, JSON.stringify(feedbackData, null, 2));
        res.redirect('/services/mess?feedback=success');
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).send(error.message);
    }
});

app.get('/services/chatRoom', authMiddleware, (req, res) => {
    try {
        const isLoggedIn = Boolean(req.cookies.jwt);
        const { role } = req.cookies;
        res.render('chatRoom.ejs', {
            role: role,
            loggedIn: isLoggedIn
        });
    } catch (error) {
        console.error("Error loading chat rooms:", error);
        res.status(500).send("Error loading chat rooms");
    }
})


app.listen(process.env.PORT, () => {
    console.log(`Server is listening on port ${process.env.PORT}`);
    console.log(`Server running on http://localhost:${process.env.PORT}/`)
});