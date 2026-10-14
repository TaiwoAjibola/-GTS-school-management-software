import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { query } from '../db/pool.js'
import { env } from '../config/env.js'
import { httpError } from '../utils/httpError.js'
import { sendRawEmail } from '../services/emailService.js'

const createToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
      fullName: user.full_name,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  )

export const login = async (req, res, next) => {
  console.log('[LOGIN] Attempting login for:', req.body?.email)
  try {
    const { email, password } = req.body

    if (!email || !password) {
      console.log('[LOGIN] Missing email or password')
      throw httpError(400, 'Email and password are required')
    }

    console.log('[LOGIN] Querying database...')
    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])
    console.log('[LOGIN] Query result rows:', result.rows?.length)

    const user = result.rows[0]
    if (!user) {
      console.log('[LOGIN] User not found')
      throw httpError(401, 'No account found with this email')
    }

    console.log('[LOGIN] Comparing password...')
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log('[LOGIN] Password valid:', isValid)

    if (!isValid) {
      throw httpError(401, 'Incorrect password')
    }

    console.log('[LOGIN] Creating token...')
    const token = createToken(user)
    console.log('[LOGIN] Login successful for:', email)

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('[LOGIN] Error:', error.message, error.status)
    next(error)
  }
}

export const me = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, s.matric_no, s.status
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.user.userId]
    )

    if (!result.rows.length) {
      throw httpError(404, 'User not found')
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) throw httpError(400, 'Email is required')

    const result = await query('SELECT id, email, full_name FROM users WHERE email = $1 LIMIT 1', [email])
    const user = result.rows[0]

    // Always return success to avoid account enumeration.
    if (user) {
      const code = randomBytes(3).toString('base64url').toUpperCase().slice(0, 6)
      await query(
        'UPDATE users SET reset_code = $1, reset_code_expires = NOW() + INTERVAL \'30 minutes\' WHERE id = $2',
        [code, user.id]
      )
      try {
        await sendRawEmail({
          to: user.email,
          subject: 'GTS Seminary — Password Reset Code',
          html: `<p>Hello ${user.full_name || ''},</p>
            <p>Your password reset code is: <strong>${code}</strong></p>
            <p>This code expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
        })
      } catch (emailErr) {
        console.error('[FORGOT] Email send failed:', emailErr.message)
      }
    }

    res.json({ message: 'If an account exists for that email, a reset code has been sent.' })
  } catch (error) {
    next(error)
  }
}

export const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body
    if (!email || !code || !newPassword) {
      throw httpError(400, 'Email, code and new password are required')
    }
    if (String(newPassword).length < 6) {
      throw httpError(400, 'Password must be at least 6 characters')
    }

    const result = await query('SELECT id, reset_code, reset_code_expires FROM users WHERE email = $1 LIMIT 1', [email])
    const user = result.rows[0]

    if (!user || !user.reset_code || user.reset_code !== String(code).toUpperCase().trim()) {
      throw httpError(400, 'Invalid or expired reset code')
    }
    if (user.reset_code_expires && new Date(user.reset_code_expires) < new Date()) {
      throw httpError(400, 'Invalid or expired reset code')
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
      [hashed, user.id]
    )

    res.json({ message: 'Password has been reset. You can now sign in.' })
  } catch (error) {
    next(error)
  }
}
