# Seminary Academic Management System (SAMS)

Modern production-ready web application for managing seminary academics: students, attendance, eligibility, assignments, and results.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT (email/password)
- Email: Nodemailer (SMTP)

## Features Implemented

- Role-based authentication (`admin`, `lecturer`, `student`)
- Student management with auto matric generation (`GTT00001`, `GTT00002`, ...)
- Course management with duration and attendance threshold
- Lecturer-controlled timed attendance session
  - one active session per course
  - countdown support via `end_time`
  - duplicate attendance prevention
- Eligibility engine based on attendance threshold
- Assignment creation and delivery to eligible students only
  - dashboard delivery
  - email delivery when SMTP is configured
- Result upload (`0-100`) with auto status (`Pass` / `Fail`)
- Role dashboards
  - Admin: students, courses, analytics
  - Lecturer: courses, attendance, assignments, results
  - Student: courses, attendance progress, eligibility, assignments, results

## Project Structure

- `client/` React app
- `server/` Express API

## Setup

### 1) Database

Create PostgreSQL database:

```bash
createdb sams_db
```

### 2) Backend

```bash
cd server
cp .env.example .env
npm install
npm run db:init
npm run dev
```

API runs on `http://localhost:5000`.

### 3) Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Default Demo Credentials

Created by `npm run db:init`:

- `admin@sams.local` / `Password123!`
- `lecturer@sams.local` / `Password123!`
- `student@sams.local` / `Password123!`

## API Overview

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/students` (admin)
- `POST /api/students/enroll` (admin)
- `GET|POST /api/courses`
- `GET /api/courses/my-courses` (student)
- `GET /api/courses/:courseId/students` (admin, lecturer)
- `POST /api/attendance/start` (admin, lecturer)
- `GET /api/attendance/course/:courseId/status`
- `POST /api/attendance/mark` (student)
- `GET /api/attendance/course/:courseId/progress` (student)
- `POST /api/assignments` (admin, lecturer)
- `GET /api/assignments/my` (student)
- `POST /api/results` (admin, lecturer)
- `GET /api/results/my` (student)
- `GET /api/dashboard/admin-analytics` (admin)

## Notes

- Eligibility is automatic from attendance records only (no manual override).
- Attendance sessions auto-close when queried after expiration.
- For email delivery, provide SMTP credentials in `server/.env`.
