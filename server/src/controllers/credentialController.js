import bcrypt from 'bcryptjs'
import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

const SALT_ROUNDS = 10

// ── List all credentials ───────────────────────────────────────────
export const listCredentials = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.created_at,
              COALESCE(u.is_active, true) AS is_active,
              s.id AS student_id, s.matric_no, s.status AS student_status
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       ORDER BY u.role, u.full_name`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Reset password ─────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { userId } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      throw httpError(400, 'Password must be at least 6 characters')
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, full_name, email',
      [hash, userId]
    )

    if (!result.rows.length) throw httpError(404, 'User not found')
    res.json({ message: 'Password reset successfully', user: result.rows[0] })
  } catch (error) {
    next(error)
  }
}

// ── Toggle account active/inactive ─────────────────────────────────
export const toggleActive = async (req, res, next) => {
  try {
    const { userId } = req.params

    // Don't allow deactivating yourself
    if (Number(userId) === req.user.userId) {
      throw httpError(400, 'Cannot deactivate your own account')
    }

    const result = await query(
      `UPDATE users
       SET is_active = NOT COALESCE(is_active, true)
       WHERE id = $1
       RETURNING id, full_name, email, is_active`,
      [userId]
    )

    if (!result.rows.length) throw httpError(404, 'User not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Create credential (new user account) ───────────────────────────
export const createCredential = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body

    if (!fullName || !email || !password) {
      throw httpError(400, 'fullName, email, and password are required')
    }

    if (!['admin', 'lecturer', 'student'].includes(role)) {
      throw httpError(400, 'role must be admin, lecturer, or student')
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length) {
      throw httpError(409, 'A user with this email already exists')
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    const result = await query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [fullName, email, hash, role]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update user role ───────────────────────────────────────────────
export const updateRole = async (req, res, next) => {
  try {
    const { userId } = req.params
    const { role } = req.body

    if (!['admin', 'lecturer', 'student'].includes(role)) {
      throw httpError(400, 'role must be admin, lecturer, or student')
    }

    if (Number(userId) === req.user.userId) {
      throw httpError(400, 'Cannot change your own role')
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role',
      [role, userId]
    )

    if (!result.rows.length) throw httpError(404, 'User not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}
