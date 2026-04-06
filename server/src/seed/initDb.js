import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { pool, query } from '../db/pool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const run = async () => {
  try {
    const schemaPath = path.join(__dirname, '../db/schema.sql')
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')

    await query(schemaSql)

    await query(`
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS class_day VARCHAR(20);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS class_time TIME;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(20);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS lecturer_name VARCHAR(120);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS has_assignment BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS has_exam BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS requires_score BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number VARCHAR(20);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS comments TEXT;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'students_status_check'
        ) THEN
          ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
          ALTER TABLE students ADD CONSTRAINT students_status_check
          CHECK (status IN ('Active', 'Graduating', 'Graduated', 'Alumni'));
        END IF;
      END$$;
      ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
      ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
      ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS class_number INT;
      UPDATE attendance_sessions SET class_number = 1 WHERE class_number IS NULL;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      ALTER TABLE results ADD COLUMN IF NOT EXISTS batch_id INT;
      ALTER TABLE results ADD COLUMN IF NOT EXISTS result_type VARCHAR(20) NOT NULL DEFAULT 'Final';
      ALTER TABLE results ALTER COLUMN score DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'suspended')),
        suspension_reason TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CHECK (end_date >= start_date)
      );

      CREATE TABLE IF NOT EXISTS student_activity_logs (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        action VARCHAR(80) NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS course_materials (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        section_number INT CHECK (section_number > 0),
        material_url TEXT NOT NULL,
        created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cohorts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        start_date DATE,
        end_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed')),
        display_order INT NOT NULL DEFAULT 0,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
      UPDATE cohorts
      SET display_order = ranked.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY start_date ASC NULLS LAST, created_at ASC) AS rn
        FROM cohorts
      ) ranked
      WHERE cohorts.id = ranked.id AND cohorts.display_order = 0;

      ALTER TABLE students ADD COLUMN IF NOT EXISTS cohort_id INT;
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS name VARCHAR(100);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_cohort_id_fk' OR conname = 'students_cohort_id_fkey'
        ) THEN
          BEGIN
            ALTER TABLE students ADD CONSTRAINT students_cohort_id_fkey
              FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;

        ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
        ALTER TABLE batches ADD CONSTRAINT batches_status_check
          CHECK (status IN ('upcoming', 'ongoing', 'completed', 'suspended'));
      END$$;

      WITH ranked_active AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY enrolled_at ASC, id ASC) AS rn
        FROM enrollments
        WHERE status = 'active'
      )
      UPDATE enrollments e
      SET status = 'completed', completed_at = COALESCE(completed_at, NOW())
      FROM ranked_active r
      WHERE e.id = r.id AND r.rn > 1;

      CREATE INDEX IF NOT EXISTS idx_batches_course_id ON batches(course_id);
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_batch
      ON attendance_sessions(batch_id)
      WHERE is_active = TRUE AND batch_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS unique_active_enrollment_per_student
      ON enrollments(student_id)
      WHERE status = 'active';

      DO $$
      BEGIN
        ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_course_id_student_id_key;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_batch_id_student_id_key'
        ) THEN
          ALTER TABLE enrollments
          ADD CONSTRAINT enrollments_batch_id_student_id_key UNIQUE (batch_id, student_id);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_batch_fk'
        ) THEN
          ALTER TABLE enrollments
          ADD CONSTRAINT enrollments_batch_fk
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'attendance_sessions_batch_fk'
        ) THEN
          ALTER TABLE attendance_sessions
          ADD CONSTRAINT attendance_sessions_batch_fk
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'assignments_batch_fk'
        ) THEN
          ALTER TABLE assignments
          ADD CONSTRAINT assignments_batch_fk
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'results_batch_fk'
        ) THEN
          ALTER TABLE results
          ADD CONSTRAINT results_batch_fk
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
        END IF;

        ALTER TABLE results DROP CONSTRAINT IF EXISTS results_course_id_student_id_key;
        ALTER TABLE results DROP CONSTRAINT IF EXISTS results_course_id_batch_id_student_id_key;

        ALTER TABLE results DROP CONSTRAINT IF EXISTS results_result_type_check;
        ALTER TABLE results ADD CONSTRAINT results_result_type_check
          CHECK (result_type IN ('Assignment', 'Exam', 'Final'));

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'results_course_id_student_id_result_type_key'
        ) THEN
          ALTER TABLE results
          ADD CONSTRAINT results_course_id_student_id_result_type_key UNIQUE (course_id, student_id, result_type);
        END IF;
      END$$;

      ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

      DO $$
      BEGIN
        ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
        ALTER TABLE students ADD CONSTRAINT students_status_check
          CHECK (status IN ('Prospective', 'Active', 'Graduating', 'Graduated', 'Alumni'));
      END$$;
    `)

    const adminEmail = 'admin@sams.local'
    const lecturerEmail = 'lecturer@sams.local'
    const studentEmail = 'student@sams.local'

    const hash = await bcrypt.hash('Password123!', 10)

    await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES
       ('System Admin', $1, $4, 'admin'),
       ('Lead Lecturer', $2, $4, 'lecturer'),
       ('Demo Student', $3, $4, 'student')
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, lecturerEmail, studentEmail, hash]
    )

    const studentUser = await query('SELECT id FROM users WHERE email = $1', [studentEmail])
    const userId = studentUser.rows[0]?.id

    if (userId) {
      await query(
        `INSERT INTO students (user_id, matric_no, phone, status)
         VALUES ($1, 'GTT00001', '+2340000000000', 'Active')
         ON CONFLICT (matric_no) DO NOTHING`,
        [userId]
      )
    }

    console.log('Database initialized successfully')
    console.log('Default users:')
    console.log('admin@sams.local / Password123!')
    console.log('lecturer@sams.local / Password123!')
    console.log('student@sams.local / Password123!')
  } catch (error) {
    console.error('Failed to initialize database', error)
  } finally {
    await pool.end()
  }
}

run()
