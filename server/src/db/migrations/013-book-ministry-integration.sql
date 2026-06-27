-- 013: Book Ministry Integration
-- Extends the placeholder tables from migration 012 with full book management tables.
-- Designed to accept data from an external Book Ministry app via sync endpoints.

-- 1. Linked accounts — maps GTS students to external book ministry accounts
CREATE TABLE IF NOT EXISTS book_linked_accounts (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  external_account_id VARCHAR(100) NOT NULL,
  external_system VARCHAR(50) NOT NULL DEFAULT 'book_ministry',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE(student_id, external_system)
);

CREATE INDEX IF NOT EXISTS idx_book_linked_accounts_student ON book_linked_accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_book_linked_accounts_external ON book_linked_accounts(external_account_id);

-- 2. Borrowing history — records of books borrowed
CREATE TABLE IF NOT EXISTS book_borrowing_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_title VARCHAR(300) NOT NULL,
  author VARCHAR(200),
  isbn VARCHAR(20),
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'borrowed'
    CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
  notes TEXT,
  synced_from VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_borrowing_student ON book_borrowing_history(student_id);
CREATE INDEX IF NOT EXISTS idx_book_borrowing_status ON book_borrowing_history(status);
CREATE INDEX IF NOT EXISTS idx_book_borrowing_isbn ON book_borrowing_history(isbn);

-- 3. Reading records — student reading progress
CREATE TABLE IF NOT EXISTS book_reading_records (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_title VARCHAR(300) NOT NULL,
  author VARCHAR(200),
  isbn VARCHAR(20),
  progress_percentage NUMERIC(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'reading'
    CHECK (status IN ('reading', 'completed', 'paused', 'abandoned')),
  notes TEXT,
  synced_from VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_reading_student ON book_reading_records(student_id);
CREATE INDEX IF NOT EXISTS idx_book_reading_status ON book_reading_records(status);

-- 4. Library permissions — access controls per student
CREATE TABLE IF NOT EXISTS book_library_permissions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL
    CHECK (permission_type IN ('borrow', 'digital_access', 'reference_only', 'reserve', 'admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_book_permissions_student ON book_library_permissions(student_id);
CREATE INDEX IF NOT EXISTS idx_book_permissions_active ON book_library_permissions(is_active);

-- 5. Access rules — borrowing limits based on student status
CREATE TABLE IF NOT EXISTS book_access_rules (
  id SERIAL PRIMARY KEY,
  student_status VARCHAR(50) NOT NULL UNIQUE,
  max_borrow_limit INTEGER NOT NULL DEFAULT 3,
  borrowing_days INTEGER NOT NULL DEFAULT 14,
  can_request_books BOOLEAN NOT NULL DEFAULT true,
  digital_access BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Seed default access rules for standard student statuses
INSERT INTO book_access_rules (student_status, max_borrow_limit, borrowing_days, can_request_books, digital_access, notes) VALUES
  ('Active', 5, 21, true, true, 'Full access for active students'),
  ('Graduating', 5, 21, true, true, 'Same as active until graduation'),
  ('Prospective', 2, 14, false, true, 'Limited digital-only access'),
  ('On Hold', 2, 14, false, true, 'Limited borrowing during hold'),
  ('Suspended', 0, 0, false, false, 'No library access while suspended'),
  ('Withdrawn', 0, 0, false, false, 'No library access after withdrawal'),
  ('Graduated', 3, 30, true, true, 'Alumni borrowing privileges'),
  ('Alumni', 3, 30, true, true, 'Alumni borrowing privileges')
ON CONFLICT (student_status) DO NOTHING;
