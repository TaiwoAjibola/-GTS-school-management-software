# SAMS - Supabase Setup & Migration Guide

## Supabase Project Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Project name:** `sams` (or your preferred name)
   - **Database password:** Generate a strong password (save it securely)
   - **Region:** Choose closest to your users (e.g., `US East` for US, `Singapore` for Asia)
4. Click **"Create new project"** (takes ~2 minutes)

### 2. Get Connection Details

After project creation:

1. Go to **Settings** (gear icon) → **Database**
2. Under **Connection string**, select **URI** tab
3. Copy the connection string:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

**Important: Two connection modes:**
- **Port 6543** (Transaction pooling) - For application runtime (use in `.env`)
- **Port 5432** (Direct connection) - For migrations/imports

### 3. Configure Supabase (Optional but Recommended)

#### Disable Row Level Security (RLS) for External App

Supabase enables RLS by default. Since SAMS uses its own auth:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE results DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_plan_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers DISABLE ROW LEVEL SECURITY;
```

#### Set Database Timezone to UTC

```sql
ALTER DATABASE postgres SET timezone TO 'UTC';
```

---

## Migration Options

### Option A: Quick Migration (Recommended)

**Prerequisites:**
- PostgreSQL client tools installed (`pg_dump`, `pg_restore`)
- Both connection strings ready

```bash
# Install PostgreSQL client (macOS)
brew install libpq
brew link --force libpq

# Set environment variables
export RENDER_DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export SUPABASE_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Run migration
chmod +x scripts/migrate-quick.sh
./scripts/migrate-quick.sh
```

### Option B: Step-by-Step Migration

#### Step 1: Export from Render

```bash
# Set Render connection details
export RENDER_DB_HOST="dpg-xxxxx.a.render.com"
export RENDER_DB_USER="your_user"
export RENDER_DB_NAME="your_db"
export RENDER_DB_PASSWORD="your_password"

# Export
chmod +x scripts/migrate-export.sh
./scripts/migrate-export.sh
```

#### Step 2: Import to Supabase

```bash
# Set Supabase connection details
export SUPABASE_DB_HOST="aws-0-xx-xx.pooler.supabase.com"
export SUPABASE_DB_PASSWORD="your_supabase_password"

# Import (uses latest export)
chmod +x scripts/migrate-import.sh
./scripts/migrate-import.sh

# Or specify a file:
./scripts/migrate-import.sh ./migrations/sams_export_20260511_120000.sql
```

### Option C: Manual SQL Import

1. Export from Render using pgAdmin or DBeaver
2. In Supabase Dashboard → SQL Editor
3. Upload and run the SQL file

---

## Update Application Configuration

### 1. Update `server/.env`

```env
NODE_ENV=production
PORT=5050

# Supabase connection (port 6543 for pooling)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=7d

CLIENT_URL=https://your-frontend-domain.com
CLIENT_URLS=https://your-frontend-domain.com,http://localhost:5173

# SMTP (keep existing or update)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="GTS School Management <your_email@gmail.com>"
```

### 2. Deploy to Render

1. Go to Render Dashboard → Your Web Service
2. Go to **Environment** tab
3. Update `DATABASE_URL` to Supabase connection string
4. Click **"Manual Deploy"** or push to Git to trigger redeploy

---

## Post-Migration Verification

### 1. Test Database Connection

```bash
# Test connection
psql "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" -c "SELECT 1"
```

### 2. Verify Tables

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- `users`
- `cohorts`
- `students`
- `student_statuses`
- `courses`
- `batches`
- `enrollments`
- `attendance_sessions`
- `attendance_records`
- `assignments`
- `assignment_deliveries`
- `course_materials`
- `results`
- `student_activity_logs`
- `course_plans`
- `course_plan_items`
- `lecturers`

### 3. Verify Row Counts

```sql
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'batches', COUNT(*) FROM batches
UNION ALL SELECT 'enrollments', COUNT(*) FROM enrollments
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
ORDER BY table_name;
```

### 4. Reset Sequences (Important!)

```sql
-- Reset matric number sequence
SELECT setval('students_matric_seq', COALESCE(
  (SELECT MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)) 
   FROM students WHERE matric_no ~ '^GTT[0-9]+$'), 
  0
));

-- Reset all SERIAL sequences
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE(MAX(id), 1)) FROM students;
SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE(MAX(id), 1)) FROM courses;
SELECT setval(pg_get_serial_sequence('batches', 'id'), COALESCE(MAX(id), 1)) FROM batches;
SELECT setval(pg_get_serial_sequence('enrollments', 'id'), COALESCE(MAX(id), 1)) FROM enrollments;
```

### 5. Test Application Features

- [ ] Login with admin/lecturer/student accounts
- [ ] Create a new student (verify matric number generation)
- [ ] Create a course
- [ ] Create a batch
- [ ] Enroll student in batch
- [ ] Start attendance session
- [ ] Mark attendance
- [ ] Create assignment
- [ ] Upload results
- [ ] View dashboards

---

## Troubleshooting

### Connection Issues

**Error: `connection refused`**
- Verify you're using correct port (5432 for direct, 6543 for pooling)
- Check Supabase project is not paused

**Error: `password authentication failed`**
- Verify password from Supabase dashboard
- Connection string format: `postgresql://postgres.[ref]:[PASSWORD]@...`

### Sequence Issues

**Error: `duplicate key value violates unique constraint`**
- Run the sequence reset SQL above

### SSL Issues

The app already handles SSL in `server/src/db/pool.js`:
```javascript
ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
```

This is compatible with Supabase.

---

## Supabase Project Structure

```
Supabase Project: sams
├── Database
│   ├── Tables (17 tables)
│   ├── Sequences
│   │   └── students_matric_seq
│   └── Indexes
├── Authentication (Disabled - using app auth)
├── Storage (Not used - files stored locally)
└── Edge Functions (Not used)
```

---

## Backup Strategy

### Automated Backups (Supabase)
- Supabase provides daily automated backups (Pro plan)
- Free plan: Manual backups only

### Manual Backup Script

```bash
#!/bin/bash
# scripts/backup-supabase.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="./backups/sams_supabase_${TIMESTAMP}.dump"

mkdir -p ./backups

pg_dump \
  "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  --format=custom \
  --verbose \
  -f "$BACKUP_FILE"

echo "Backup saved: $BACKUP_FILE"
```

### Cron Backup (Weekly)

```bash
# Add to crontab: crontab -e
0 2 * * 0 /path/to/scripts/backup-supabase.sh
```

---

## Rollback Plan

If migration fails:

1. **Keep Render database running** (don't delete immediately)
2. **Revert `DATABASE_URL`** in Render environment variables
3. **Redeploy** to Render
4. Application will use Render database again

Wait at least 1-2 weeks before deleting Render database.
