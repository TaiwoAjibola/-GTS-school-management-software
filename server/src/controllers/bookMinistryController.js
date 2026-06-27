import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ---- Settings ----
export const getSettings = async (req, res, next) => {
  try {
    const result = await query('SELECT key, value, description FROM book_ministry_settings ORDER BY key')
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const updateSetting = async (req, res, next) => {
  try {
    const { key, value } = req.body
    if (!key) throw httpError(400, 'key is required')
    const result = await query(
      `UPDATE book_ministry_settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *`,
      [value, key]
    )
    if (!result.rows.length) throw httpError(404, 'Setting not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ---- Linked Accounts ----
export const listLinkedAccounts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT bla.id, bla.student_id, bla.external_account_id, bla.external_system,
              bla.linked_at, bla.last_synced_at,
              u.full_name, s.matric_no, s.status AS student_status
       FROM book_linked_accounts bla
       JOIN students s ON s.id = bla.student_id
       JOIN users u ON u.id = s.user_id
       ORDER BY u.full_name ASC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const linkAccount = async (req, res, next) => {
  try {
    const { studentId, externalAccountId, externalSystem } = req.body
    if (!studentId || !externalAccountId) throw httpError(400, 'studentId and externalAccountId are required')
    const result = await query(
      `INSERT INTO book_linked_accounts (student_id, external_account_id, external_system)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, external_system)
       DO UPDATE SET external_account_id = EXCLUDED.external_account_id, last_synced_at = NOW()
       RETURNING *`,
      [studentId, externalAccountId, externalSystem || 'book_ministry']
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const unlinkAccount = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!id) throw httpError(400, 'Valid id is required')
    const result = await query('DELETE FROM book_linked_accounts WHERE id = $1 RETURNING id', [id])
    if (!result.rows.length) throw httpError(404, 'Linked account not found')
    res.json({ message: 'Account unlinked' })
  } catch (error) {
    next(error)
  }
}

// ---- Borrowing History ----
export const listBorrowingHistory = async (req, res, next) => {
  try {
    const studentId = Number(req.query.studentId || 0)
    const result = await query(
      `SELECT bh.*, u.full_name, s.matric_no, s.status AS student_status
       FROM book_borrowing_history bh
       JOIN students s ON s.id = bh.student_id
       JOIN users u ON u.id = s.user_id
       WHERE ($1 = 0 OR bh.student_id = $1)
       ORDER BY bh.borrowed_at DESC`,
      [studentId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createBorrowingRecord = async (req, res, next) => {
  try {
    const { studentId, bookTitle, author, isbn, borrowedAt, dueAt, notes, syncedFrom } = req.body
    if (!studentId || !bookTitle) throw httpError(400, 'studentId and bookTitle are required')
    const result = await query(
      `INSERT INTO book_borrowing_history (student_id, book_title, author, isbn, borrowed_at, due_at, notes, synced_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [studentId, bookTitle, author || null, isbn || null, borrowedAt || new Date(), dueAt || null, notes || null, syncedFrom || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateBorrowingRecord = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { status, returnedAt, notes } = req.body
    if (!id) throw httpError(400, 'Valid id is required')
    const result = await query(
      `UPDATE book_borrowing_history SET status = COALESCE($1, status), returned_at = COALESCE($2, returned_at), notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status || null, returnedAt || null, notes ?? null, id]
    )
    if (!result.rows.length) throw httpError(404, 'Borrowing record not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ---- Reading Records ----
export const listReadingRecords = async (req, res, next) => {
  try {
    const studentId = Number(req.query.studentId || 0)
    const result = await query(
      `SELECT rr.*, u.full_name, s.matric_no
       FROM book_reading_records rr
       JOIN students s ON s.id = rr.student_id
       JOIN users u ON u.id = s.user_id
       WHERE ($1 = 0 OR rr.student_id = $1)
       ORDER BY rr.created_at DESC`,
      [studentId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createReadingRecord = async (req, res, next) => {
  try {
    const { studentId, bookTitle, author, isbn, startedAt, syncedFrom } = req.body
    if (!studentId || !bookTitle) throw httpError(400, 'studentId and bookTitle are required')
    const result = await query(
      `INSERT INTO book_reading_records (student_id, book_title, author, isbn, started_at, synced_from)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [studentId, bookTitle, author || null, isbn || null, startedAt || new Date(), syncedFrom || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateReadingRecord = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { progressPercentage, status, completedAt, notes } = req.body
    if (!id) throw httpError(400, 'Valid id is required')
    const result = await query(
      `UPDATE book_reading_records SET
        progress_percentage = COALESCE($1, progress_percentage),
        status = COALESCE($2, status),
        completed_at = CASE WHEN $3 THEN $3 WHEN $2 = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
        notes = COALESCE($4, notes),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [progressPercentage ?? null, status || null, completedAt || null, notes ?? null, id]
    )
    if (!result.rows.length) throw httpError(404, 'Reading record not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ---- Library Permissions ----
export const listPermissions = async (req, res, next) => {
  try {
    const studentId = Number(req.query.studentId || 0)
    const result = await query(
      `SELECT blp.*, u.full_name AS student_name, s.matric_no,
              granter.full_name AS granted_by_name
       FROM book_library_permissions blp
       JOIN students s ON s.id = blp.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users granter ON granter.id = blp.granted_by
       WHERE ($1 = 0 OR blp.student_id = $1)
       ORDER BY blp.granted_at DESC`,
      [studentId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const grantPermission = async (req, res, next) => {
  try {
    const { studentId, permissionType, expiresAt, notes } = req.body
    if (!studentId || !permissionType) throw httpError(400, 'studentId and permissionType are required')
    const validTypes = ['borrow', 'digital_access', 'reference_only', 'reserve', 'admin']
    if (!validTypes.includes(permissionType)) throw httpError(400, `permissionType must be one of: ${validTypes.join(', ')}`)
    const result = await query(
      `INSERT INTO book_library_permissions (student_id, permission_type, expires_at, granted_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, permission_type)
       DO UPDATE SET is_active = true, expires_at = COALESCE(EXCLUDED.expires_at, book_library_permissions.expires_at),
                     granted_by = EXCLUDED.granted_by, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [studentId, permissionType, expiresAt || null, req.user.userId, notes || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const revokePermission = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!id) throw httpError(400, 'Valid id is required')
    const result = await query(
      `UPDATE book_library_permissions SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Permission not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ---- Access Rules ----
export const listAccessRules = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM book_access_rules ORDER BY student_status ASC')
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const updateAccessRule = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { maxBorrowLimit, borrowingDays, canRequestBooks, digitalAccess, notes } = req.body
    if (!id) throw httpError(400, 'Valid id is required')
    const result = await query(
      `UPDATE book_access_rules SET
        max_borrow_limit = COALESCE($1, max_borrow_limit),
        borrowing_days = COALESCE($2, borrowing_days),
        can_request_books = COALESCE($3, can_request_books),
        digital_access = COALESCE($4, digital_access),
        notes = COALESCE($5, notes),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [maxBorrowLimit ?? null, borrowingDays ?? null, canRequestBooks ?? null, digitalAccess ?? null, notes ?? null, id]
    )
    if (!result.rows.length) throw httpError(404, 'Access rule not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ---- Dashboard Stats ----
export const getDashboardStats = async (req, res, next) => {
  try {
    const [linked, borrowed, reading, permissions, requests] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM book_linked_accounts'),
      query(`SELECT COUNT(*)::int AS count FROM book_borrowing_history WHERE status = 'borrowed'`),
      query(`SELECT COUNT(*)::int AS count FROM book_reading_records WHERE status IN ('reading', 'paused')`),
      query('SELECT COUNT(*)::int AS count FROM book_library_permissions WHERE is_active = true'),
      query(`SELECT COUNT(*)::int AS count FROM book_requests WHERE status = 'pending'`),
    ])
    res.json({
      linkedAccounts: linked.rows[0].count,
      activeBorrows: borrowed.rows[0].count,
      activeReading: reading.rows[0].count,
      activePermissions: permissions.rows[0].count,
      pendingRequests: requests.rows[0].count,
    })
  } catch (error) {
    next(error)
  }
}

// ---- Book Requests (from migration 012) ----
export const listBookRequests = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT br.*, u.full_name AS student_name, s.matric_no,
              req.full_name AS requested_by_name
       FROM book_requests br
       JOIN students s ON s.id = br.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users req ON req.id = br.requested_by
       ORDER BY br.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const updateBookRequest = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { status, notes } = req.body
    if (!id) throw httpError(400, 'Valid id is required')
    const validStatuses = ['pending', 'approved', 'fulfilled', 'cancelled']
    if (status && !validStatuses.includes(status)) throw httpError(400, `Status must be one of: ${validStatuses.join(', ')}`)
    const result = await query(
      `UPDATE book_requests SET
        status = COALESCE($1, status),
        fulfilled_at = CASE WHEN $1 = 'fulfilled' AND fulfilled_at IS NULL THEN NOW() ELSE fulfilled_at END,
        notes = COALESCE($2, notes),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status || null, notes ?? null, id]
    )
    if (!result.rows.length) throw httpError(404, 'Book request not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}
