# Hostelia — Complete Project Technical Reference

## 1. Project Overview

**Hostelia** is a full-stack, multi-tenant hostel management platform designed for colleges. It digitises every aspect of hostel administration — complaint tracking, fee management, mess menus, transit logging, announcements, and real-time notifications — and exposes role-tailored dashboards for students, wardens, college administrators, and a platform-level manager.

---

## 2. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 (Vite + TypeScript) |
| Routing | React Router v7 |
| State Management | Redux Toolkit (RTK) |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI (headless), shadcn/ui wrappers |
| Icons | Lucide React |
| Charts / Analytics | Recharts |
| Forms | React Hook Form + Zod |
| HTTP Client | Axios |
| CSV Parsing | PapaParse |
| Notifications (toast) | Sonner |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express v5 |
| Database | MongoDB (via Mongoose v8) |
| Auth | JWT (httpOnly cookies) + bcrypt |
| Validation | Zod v4 |
| File Upload | Multer (memory storage) |
| Cloud Storage | Cloudinary |
| Email | Resend API |
| Logging | Winston + winston-daily-rotate-file |
| Real-time | Server-Sent Events (SSE) |

---

## 3. User Roles

| Role | Scope |
|---|---|
| `student` | Registered student of a college |
| `warden` | Manages one hostel within a college |
| `collegeAdmin` | Full admin of a college and all its hostels |
| `manager` | Platform-level super admin (manages colleges on the platform) |

---

## 4. Authentication & Security

### Flow
1. **Signup** — OTP email sent via Resend; OTP verified before account creation.
2. **Domain Validation** — Email domain must match the college's registered `emailDomain`.
3. **College Approval Gate** — Registration/login blocked for unapproved colleges.
4. **Login** — JWT signed and set as an `httpOnly` cookie (7-day expiry). Role, user ID, and college ID also stored in non-httpOnly cookies for client reads.
5. **Manager Login** — Separate endpoint; no `collegeId` required.
6. **Logout** — Clears all cookies.

### Security Measures
- Passwords hashed with `bcrypt` (salt rounds: 10)
- JWT verification on every protected route via `authMiddleware`
- CORS configured with allowed-origins whitelist (supports dynamic localhost ports)
- `authorizeRoles(...)` middleware for role-based route access
- Multer file-type filters per upload type (images only, images + PDF, images + PDF + doc)
- Zod schema validation on all controller inputs
- OTP expires after 10 minutes (MongoDB TTL index)

---

## 5. Database Models (MongoDB / Mongoose)

### `User`
Fields: `role` (student/collegeAdmin/warden/manager), `name`, `rollNo` (3-digit, sparse unique), `email` (unique), `hostelId` (ref Hostel), `messId` (ref Mess), `collegeId` (ref College), `roomNo`, `password` (hashed), `timestamps`

### `College`
Fields: `name`, `emailDomain` (unique), `adminEmail` (unique), `address`, `logo` (Cloudinary URL), `status` (pending/approved/rejected), `subscriptionStatus` (trial/active/inactive), `subscriptionExpiresAt`, `timestamps`

### `Hostel`
Fields: `name`, `collegeId` (ref College), `capacity`, `timestamps`
Compound unique index: `(name, collegeId)`

### `Mess`
Fields: `name`, `collegeId` (ref College), `capacity`, `timestamps`
Compound unique index: `(name, collegeId)`

### `Problem` (Complaints)
Fields: `problemTitle`, `problemDescription`, `problemImage` (Cloudinary URL), `hostelId`, `collegeId`, `roomNo`, `category` (Electrical/Plumbing/Painting/Carpentry/Cleaning/Internet/Furniture/Pest Control/Student Misconduct/Other), `studentId`, `status` (Pending/Resolved/Rejected/ToBeConfirmed), `studentStatus` (NotResolved/Resolved/Rejected), `studentVerifiedAt`, `resolvedAt`, `comments[]` (sub-schema: user, role, message, createdAt), `timestamps`
Compound index: `(collegeId, hostelId, status, createdAt)`

### `Announcement`
Fields: `title`, `message`, `postedBy` (embedded: name, email, role), `fileUrl` (Cloudinary URL, optional), `collegeId`, `comments[]` (same sub-schema as Problem), `timestamps`

### `FeeSubmission`
Fields: `studentId` (unique ref User), `studentName`, `studentEmail`, `collegeId`, `hostelFee` (embedded: status, documentUrl), `messFee` (embedded: status, documentUrl)
Fee statuses: `documentNotSubmitted / pending / approved / rejected`

### `Menu`
Fields: `day` (Sun–Sat), `messId`, `collegeId`, `meals` (Breakfast/Lunch/Snacks/Dinner — each an array of strings), `timestamps`
Unique index: `(messId, day)`

### `Feedback` (Mess Ratings)
Fields: `date`, `day`, `mealType` (Breakfast/Lunch/Snacks/Dinner), `rating` (1–5), `comment`, `user` (ref User), `collegeId`, `messId`, `timestamps`
Compound indexes for efficient per-mess and per-user queries

### `Transit`
Fields: `studentId`, `collegeId`, `purpose`, `transitStatus` (ENTRY/EXIT), `date`, `time` (HH:MM:SS), `timestamps`

### `Notification`
Fields: `userId`, `collegeId`, `type` (10 event types), `title`, `message`, `relatedEntityId`, `relatedEntityType` (problem/announcement/fee/transit/mess/contact), `read`, `readAt`, `timestamps`
Compound index: `(collegeId, userId, read, createdAt)`

### `OTP`
Fields: `email` (unique), `otp`, `createdAt` (TTL: 600 seconds)

---

## 6. Backend API Endpoints

All routes are prefixed with `/api`. Protected routes require a valid JWT cookie.

### Auth — `/api/auth`
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/generate-otp` | Public | Send 6-digit OTP to email (with domain validation) |
| POST | `/verify-otp` | Public | Verify OTP; optionally create account if `userData` provided |
| POST | `/signup` | Public | Create student account (after OTP verified) |
| POST | `/login` | Public | Login; returns JWT cookie |
| POST | `/manager-login` | Public | Manager-specific login |
| POST | `/logout` | Auth | Clear all auth cookies |

### Users — `/api/user`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/students/all` | admin, warden | List all students (warden: own hostel only) |
| GET | `/wardens/all` | admin | List all wardens |
| GET | `/getName/:userId` | Auth | Get name + role of a user |
| GET | `/:userId` | Auth | Get full user profile |
| PUT | `/update/:userId` | admin, warden | Update user details |
| DELETE | `/:userId` | admin | Delete user |
| POST | `/bulk-upload` | admin, warden | Bulk-create/upsert students from JSON (up to 200) |

### Problems (Complaints) — `/api/problem`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Auth | List complaints (scoped by role: own/hostel/all) |
| POST | `/` | student | Create complaint with image upload |
| POST | `/:id/comments` | Auth | Add comment to a complaint |
| PATCH | `/:id/status` | warden, admin | Update complaint status |
| PATCH | `/:id/verify` | student | Student verifies/rejects resolution |

### Announcements — `/api/announcement`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Auth | List announcements for college |
| POST | `/` | warden, admin | Create announcement with optional file |
| DELETE | `/:id` | warden, admin | Delete announcement |
| POST | `/:id/comments` | Auth | Comment on announcement |

### Fees — `/api/fee`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Auth | Get fee status (student: own, warden: hostel, admin: all) |
| POST | `/hostel` | student | Submit hostel fee document |
| POST | `/mess` | student | Submit mess fee document |
| PATCH | `/:studentId/status` | admin | Update fee approval status |
| POST | `/email/reminder` | admin, warden | Send fee reminder email to a student |
| POST | `/email/bulk-reminder` | admin, warden | Send bulk fee reminder emails |

### Mess — `/api/mess`
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/create` | admin | Create a new mess |
| GET | `/list` | Auth | List all messes in college |
| GET | `/menu` | Auth | Get weekly menu for a mess (`?messId=...`) |
| PUT | `/menu` | admin, warden | Update mess menu |
| POST | `/feedback` | student | Submit meal rating and comment |
| GET | `/feedback` | admin, warden | View all mess feedback |

### Transit — `/api/transit`
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | student | Log entry/exit with purpose |
| GET | `/` | Auth | List transit entries (scoped by role) |

### Notifications — `/api/notifications`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/stream` | Auth | SSE stream for real-time notifications |
| GET | `/` | Auth | List all notifications (with pagination) |
| GET | `/unread-count` | Auth | Get unread notification count |
| PATCH | `/:id/read` | Auth | Mark single notification as read |
| PATCH | `/read-all` | Auth | Mark all notifications as read |

### Hostels — `/api/hostel`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/list` | Auth | List hostels in college |
| POST | `/create` | admin | Create a new hostel |

### Warden — `/api/warden`
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | admin | List all wardens |
| POST | `/create` | admin | Appoint a new warden (creates account directly) |

### College — `/api/college` (public)
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/register` | Public | Register a new college (with logo upload) |
| GET | `/list` | Public | List all colleges |
| GET | `/:collegeId/hostels` | Public | Get hostels for a college |

### Contact — `/api/contact` (public)
| Method | Path | Description |
|---|---|---|
| POST | `/` | Submit a contact/support message |

### Manager — `/api/manager` (manager role only)
| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Platform-wide stats + monthly trend data |
| GET | `/colleges` | List all registered colleges |
| GET | `/colleges/pending` | List pending colleges |
| POST | `/colleges/:id/approve` | Approve a college registration |
| POST | `/colleges/:id/reject` | Reject a college registration |

---

## 7. Frontend Pages & Routes

| Route | Page | Access |
|---|---|---|
| `/` | Home (landing page) | Public |
| `/about` | About | Public |
| `/contact` | Contact form | Public |
| `/login` | Login | Guest only |
| `/signup` | Signup (with OTP flow) | Guest only |
| `/dashboard` | Role-based dashboard | Auth |
| `/complaints` | List complaints | Auth |
| `/complaints/:id` | Complaint detail | Auth |
| `/fees` | Fee management | Auth |
| `/mess` | Mess menu & feedback | Auth |
| `/announcements` | Announcements list | Auth |
| `/announcements/:id` | Announcement detail | Auth |
| `/transit` | Transit log | Auth |
| `/users` / `/user-management` | User management | admin |
| `/student/:id` | Student profile detail | admin, warden |
| `/college` | College management | admin |
| `/manager/login` | Manager login | Public |
| `/manager/dashboard` | Platform dashboard | manager |
| `/manager/colleges` | All colleges list | manager |
| `/manager/pending` | Pending approvals | manager |

---

## 8. Features — Detailed Breakdown

### 8.1 Authentication
- **OTP Email Verification**: On signup, a 6-digit OTP (10-min TTL) is emailed via Resend. Verification either confirms email or creates the account atomically.
- **College Domain Enforcement**: Email must match the `emailDomain` registered for the selected college.
- **Approval Gate**: Students cannot register or log in until the college has been approved by the platform manager.
- **JWT Cookie Auth**: Token stored in `httpOnly` strict-same-site cookie; refreshes are not implemented (7-day expiry).
- **Frontend Persistence**: Auth state (user data) persisted to `localStorage` and rehydrated on page load via Redux initial state.

### 8.2 Complaint (Problem) Management
- Students submit complaints with: title, description, category, hostel, room number, and an image (JPEG/PNG, max 10 MB) uploaded to Cloudinary.
- **Categories**: Electrical, Plumbing, Painting, Carpentry, Cleaning, Internet, Furniture, Pest Control, Student Misconduct, Other.
- **Status Lifecycle**: `Pending` → `ToBeConfirmed` (warden marks resolved) → student verifies → `Resolved` or `Rejected`.
- **Dual Status**: Warden/admin updates `status`; student independently sets `studentStatus` (NotResolved/Resolved/Rejected).
- **Comment Thread**: All roles can add comments with role label.
- **Scoped visibility**: Student sees only own complaints; warden sees hostel complaints; admin sees all.
- **Filtering**: By status, category, hostel, date range, search query.
- **Progress Timeline UI**: Visual timeline showing status history on complaint detail page.

### 8.3 Announcements
- Warden or admin posts announcement with title, message body, and optional file attachment (JPEG/PNG/PDF/DOC/DOCX, max 10 MB uploaded to Cloudinary).
- All authenticated users in the college can view.
- **Document Viewer**: Built-in viewer handles images (full-screen), PDFs (blob-fetched with object URL), and other documents.
- **Comment Section**: Any authenticated user can comment.
- Warden/admin can delete announcements.

### 8.4 Fee Management
- **Auto-created on Signup**: A `FeeSubmission` record with both fees as `documentNotSubmitted` is created for every new student.
- **Document Submission**: Students upload hostel fee or mess fee receipt (image or PDF) which is stored on Cloudinary.
- **Status Flow**: `documentNotSubmitted → pending → approved / rejected` (admin updates status).
- **Email Reminders**: Warden/admin can send individual or bulk reminder emails via Resend for unpaid fees.
- **Document Viewer**: Inline viewer with full-screen mode, download support, PDF blob-rendering.
- **Analytics**: Fee submission statistics and charts in admin/warden dashboard.

### 8.5 Mess Management
- **Menu**: Weekly grid (Sun–Sat × Breakfast/Lunch/Snacks/Dinner). Warden/admin edits items per slot.
- **Feedback**: Students rate each meal (1–5 stars) with optional text comment; feedback is date/mealType/mess-scoped.
- **Analytics**: Warden/admin dashboard shows average rating and feedback volume.
- **Dashboard Widget**: Today's menu shown on student dashboard.

### 8.6 Transit Management
- Students log ENTRY or EXIT events with a purpose and auto-captured timestamp.
- Warden/admin can view all transit entries scoped to their college/hostel.

### 8.7 Real-time Notification System
- **SSE (Server-Sent Events)**: Long-lived HTTP connection streams notifications to connected clients. 30-second ping keepalive. Cleans up on disconnect.
- **10 Notification Types**: problem_created, problem_status_updated, announcement_created, mess_feedback_submitted, hostel_fee_submitted, mess_fee_submitted, fee_status_updated, mess_menu_updated, fee_submission_required, contact_message_received.
- **Notification Bell**: Navbar badge shows unread count; dropdown shows recent notifications with read/unread states.
- **Mark as Read**: Per-notification or bulk "mark all read".

### 8.8 User Management (Admin)
- **View Students/Wardens**: Paginated, filterable tables with hostel/search filters.
- **Create Warden**: Admin directly creates warden account (bypasses student OTP flow).
- **Update User**: Admin/warden can update name, hostel, room, mess assignment.
- **Delete User**: Admin can delete any user.
- **Bulk CSV Upload** (up to 200 students):
  - Parsed client-side with PapaParse.
  - Two modes: `create` (skip existing) or `upsert` (update existing by email).
  - Per-row validation: domain check, hostel/mess name lookup, rollNo uniqueness, warden hostel restriction.
  - Returns detailed results: `created`, `updated`, `skipped`, `errors` per row.
  - Automatically creates `FeeSubmission` records for newly created students.

### 8.9 Role-Specific Dashboards
**Student Dashboard**:
- Metrics: complaint counts (total/pending/resolved/rejected), hostel fee status, mess fee status.
- Widgets: recent complaints (last 2), recent announcements (last 3), today's mess menu, quick actions.

**Warden Dashboard**:
- Metrics: student count in hostel, complaint stats, fee pending count (hostel+mess), mess feedback avg rating.
- Detailed views (expandable panels): complaints list, students list, fees list, mess feedback list.

**College Admin Dashboard**:
- Same metrics as warden but across all hostels.
- Additional detailed view: wardens list.
- All data unfiltered across the entire college.

### 8.10 College & Hostel Setup
- **College Registration**: Public form with name, email domain, admin email, address, logo upload.
- **Manager Approval**: New colleges are `pending` until platform manager approves/rejects.
- **Hostel Creation**: Admin creates hostels with name and capacity.
- **Mess Creation**: Admin creates messes.

### 8.11 Manager Portal (Platform Level)
- Separate login (no college association).
- **Dashboard**: Total colleges, approved/pending/rejected breakdown, total users, hostels, messes, plus line charts for college and user signup trends over the last 6 months.
- **College Approval**: Review pending registrations, approve or reject.

### 8.12 Student Detail Page
- Full student profile view for warden/admin.
- Shows: fee status, complaint history, mess feedback list, transit history, stats card.

### 8.13 Contact Form
- Public form submitting a support/contact message; triggers a `contact_message_received` notification to admin.

---

## 9. Third-party Integrations

| Service | Purpose | Environment Variable |
|---|---|---|
| **Cloudinary** | Store images (complaints, college logo) and files (announcements, fee docs) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Resend** | Transactional email (OTP verification, fee reminders) | `EMAIL_PASS` (Resend API key), `EMAIL_USER` (from address) |
| **MongoDB Atlas** | Primary database | `MONGO_URI` (inferred) |

---

## 10. Project Structure

```
Hostelia_FFSD_Project/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── store.ts                      # Redux store
│   │   ├── hooks.ts                      # Typed Redux hooks
│   │   ├── features/
│   │   │   ├── auth/authSlice.ts
│   │   │   ├── complaints/complaintsSlice.ts
│   │   │   ├── dashboard/dashboardSlice.ts
│   │   │   ├── fees/feesSlice.ts
│   │   │   └── users/usersSlice.ts
│   │   ├── pages/                        # All page components
│   │   ├── routes/                       # Route definitions + guards
│   │   │   ├── auth.tsx, public.tsx, protected.tsx, mixed.tsx
│   │   │   └── guards/ (RequireAuth, OnlyGuests, StudentOnly)
│   │   ├── components/
│   │   │   ├── ui/                       # Radix UI wrappers (shadcn)
│   │   │   ├── layout/ (Navbar, Footer, SidebarLayout)
│   │   │   ├── complaints/
│   │   │   ├── announcements/
│   │   │   ├── fees/
│   │   │   ├── mess/
│   │   │   ├── notifications/
│   │   │   ├── dashboard/
│   │   │   └── student-detail/
│   │   └── lib/
│   │       ├── api-client.ts             # Axios instance (Bearer token + credentials)
│   │       ├── user-api.ts
│   │       └── cloudinary-utils.ts
│   └── package.json
│
└── backend/
    ├── index.js                          # App entry: DB connect, Express setup
    ├── routes/                           # One file per domain
    ├── controllers/                      # Business logic
    ├── models/                           # Mongoose schemas
    ├── middleware/
    │   ├── auth.middleware.js            # JWT verification
    │   ├── roles.js                      # authorizeRoles()
    │   ├── domainValidation.middleware.js
    │   ├── multerErrorHandler.js
    │   └── logger.js                     # Winston logger
    ├── config/
    │   ├── database.js                   # Mongoose connection
    │   └── cloudinary.js                 # Multer + Cloudinary config
    ├── utils/
    │   ├── email-client.js               # Resend wrapper
    │   └── notificationService.js        # SSE connections + DB notification logic
    └── package.json
```

---

## 11. Redux State Slices

| Slice | State Managed |
|---|---|
| `auth` | Current user, isAuthenticated, loading, error; persisted to localStorage |
| `complaints` | Complaint list, selected complaint, filters, CRUD + comment + status/verify async thunks |
| `dashboard` | Role-specific metrics, recent items, detailed view tabs, paginated sub-lists for complaints/students/fees/mess/wardens |
| `fees` | Fee submissions, submit/update/remind loading states |
| `users` | Students list, wardens list, CRUD + bulk upload operations |

---

## 12. Key Architectural Decisions

- **Multi-tenant by design**: Every model includes `collegeId`. Queries are scoped to the authenticated user's college, enforced in controllers.
- **Role-scoped data**: The same GET endpoint returns different data based on `req.user.role` (student sees own, warden sees hostel, admin sees all).
- **SSE over WebSockets**: Server-Sent Events chosen for real-time notifications — simpler than WebSockets for one-directional server→client push.
- **Cloudinary with memory storage**: Files are never written to disk; Multer buffers them in RAM, then streamed directly to Cloudinary via `upload_stream`.
- **OTP in DB (not in-memory)**: OTP records stored in MongoDB with a TTL index (10 minutes), surviving server restarts and supporting horizontal scaling.
- **FeeSubmission auto-created**: On every new user signup (both via form and bulk upload), a `FeeSubmission` doc is created so the admin always has a row to track.
- **Frontend API client**: Axios instance reads JWT from cookie via `withCredentials: true`, and also attaches a Bearer token from localStorage if present (dual-mode for compatibility).
