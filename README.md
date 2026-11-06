# Hostelia - Hostel Management System

Hostelia is a full-stack hostel management platform for students, wardens, college admins, and platform managers. It covers user and hostel operations, complaints, fee workflows, mess and transit management, announcements, and real-time notifications.

## Getting Started

### Prerequisites

- Node.js `v18+`
- npm
- MongoDB (local or Atlas)
- Cloudinary account (for media/document uploads)
- Resend API key (used through `EMAIL_PASS` in backend env)
- Redis (optional but recommended for cache-enabled endpoints)

### 1) Backend setup

1. Open backend folder:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` from `.env.sample`:

   ```env
   JWT_SECRET=your-secret-key-here
   MONGO_URI=mongodb://localhost:27017/hostelia
   PORT=3000

   FRONTEND_URL=http://localhost:5173
   FRONTEND_URLS=http://localhost:5173,http://localhost:5174
   NODE_ENV=development

   REDIS_URL=redis://localhost:6379

   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-verified-sender@domain.com
   EMAIL_PASS=your-resend-api-key

   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. Run backend:

   ```bash
   npm run dev
   ```

   Backend runs at `http://localhost:3000`.

### 2) Frontend setup

1. Open frontend folder:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run frontend:

   ```bash
   npm run dev
   ```

   Frontend runs at `http://localhost:5173`.

### 3) Run both quickly

Use two terminals:

- Terminal 1: `cd backend && npm run dev`
- Terminal 2: `cd frontend && npm run dev`

### 4) Docker (optional)

`docker-compose.yaml` includes `backend`, `frontend`, `redis`, and `rabbitmq` services.

```bash
docker compose up --build
```

### 5) Testing and reports

From `backend/`:

- `npm test` - run tests
- `npm run test:watch` - watch mode
- `npm run test:coverage` - coverage report (includes HTML report output)

### API documentation

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api/docs.json`

Swagger is enabled by default.

## Tech Stack

### Frontend

- React 19 + TypeScript
- Vite
- Redux Toolkit
- React Router v7
- Tailwind CSS v4 + shadcn/ui
- React Hook Form + Zod
- Axios
- Recharts

### Backend

- Node.js + Express 5
- MongoDB + Mongoose
- JWT auth + role-based access control
- Cloudinary uploads (images/docs)
- Resend email integration
- Redis cache layer (`ioredis`) with graceful fallback
- GraphQL (`/api/graphql`) for health/me
- Swagger/OpenAPI
- Winston logging

## Features

- Multi-role auth (student, warden, collegeAdmin, manager)
- College registration and manager approval workflows
- Hostel and warden management
- Complaint lifecycle (create, comment, status update, verification)
- Complaint evidence uploads with validation and error handling
- Fee submission/review workflows (hostel + mess)
- Mess menu and feedback management
- Transit in/out tracking
- Announcements with attachment support
- Real-time notifications via SSE
- Redis-backed caching for selected list endpoints
- Search/index-aware query paths and pagination-friendly data access

## Project Structure

```text
Hostelia_FFSD_Project/
├── backend/
│   ├── api-docs/
│   ├── config/
│   ├── controllers/
│   ├── graphql/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── tests/
│   ├── utils/
│   └── index.js
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI and domain components
│   │   ├── features/     # Redux slices/state modules
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # API clients and shared utilities
│   │   ├── pages/        # Route-level pages
│   │   ├── routes/       # Router config + guards
│   │   ├── store.ts      # Redux store setup
│   │   ├── hooks.ts      # Typed Redux hooks
│   │   └── App.tsx
│   └── package.json
├── docker-compose.yaml
└── README.md
```

## API Endpoints

| Module         | Base Route           |
| -------------- | -------------------- |
| Authentication | `/api/auth`          |
| Users          | `/api/user`          |
| Wardens        | `/api/warden`        |
| Complaints     | `/api/problem`       |
| Mess           | `/api/mess`          |
| Transit        | `/api/transit`       |
| Announcements  | `/api/announcement`  |
| Fees           | `/api/fee`           |
| Contact        | `/api/contact`       |
| Notifications  | `/api/notifications` |
| Colleges       | `/api/college`       |
| Hostels        | `/api/hostel`        |
| Manager        | `/api/manager`       |
| GraphQL        | `/api/graphql`       |

## Documentation

- Live API docs: `/api-docs` and `/api/docs.json`
- Source OpenAPI spec: `backend/api-docs/openapi.js`
- Swagger setup: `backend/config/swagger.js`
- If local markdown docs are generated in your environment, keep them under `docs/` for project reports/presentations.

## Group 52 - Team Contributions

### Rohan Dubey

**Roll No:** S20230010207

- Dashboard & Analytics
- Authorization System
- CI/CD pipeline
- Dockerization of application

### Saurav Singh

**Roll No:** S20230010219

- User Management
- Warden Management
- Complaints Module
- Redis cache integration touchpoints for mess/transit-heavy flows
- Testing of controller endpoints

### Ashutosh Sinha

**Roll No:** S20230010027

- Mess Management
- Feedback System
- Transit Module
- DB optimization improvements
- Testing of view endpoints

### Abhiraj Singh Chauhan

**Roll No:** S20230010002

- Announcements
- Fee Management
- Project Setup & Backend Architecture
- Email & Real-time Notification System
- Deployment readiness

### C. Venkata Sivaji

**Roll No:** S20230010063

- Contact Page
- About Page
- Homepage
- Testing of model endpoints
- GraphQL endpoints

---

**Hostelia** - Simplifying hostel management for students and administrators.
