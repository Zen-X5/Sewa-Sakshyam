# Online Exam Platform

Full-stack exam platform with:

- Next.js frontend (vanilla CSS)
- Express.js backend
- MongoDB Atlas integration
- JWT auth (admin/student roles)
- One-question exam UI with timer, auto-save, anti-cheating auto-submit

## Project Structure

```
exam-platform/
  backend/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
  frontend/
    app/
    lib/
```

## Backend Setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - optional default admin values (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
3. Install and run:

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000` by default.

## Frontend Setup

1. Copy `frontend/.env.local.example` to `frontend/.env.local`.
2. Ensure API URL points to backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

3. Install and run:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Default Flows

- Admin Login: `/admin/login`
- Student Register/Login: `/student/register`, `/student/login`
- Student Dashboard: `/student/dashboard`

## Core Features Implemented

- Role-based auth (`admin`, `student`)
- Admin exam/section/question management
- Publish/unpublish exams
- Student exam listing and instruction page
- Attempt start + one-question navigation
- Timer based on server attempt start time
- Auto-save answer API on option click
- Anti-cheating submit triggers:
  - `visibilitychange`
  - `blur`
  - `fullscreenchange`
- Scoring:
  - Correct: `+4` (configurable)
  - Wrong: `-1` (configurable)
  - Unattempted: `0`
- Result and section-wise analytics

## Next Recommended Enhancements

- Redis for autosave buffering / session controls
- Socket.io proctoring dashboard
- Question import via CSV/Excel
- Rate limiting and audit logs
- Unit/integration tests and CI pipeline
