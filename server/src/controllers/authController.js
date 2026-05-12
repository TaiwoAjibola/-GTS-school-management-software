import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/pool.js'
import { env } from '../config/env.js'
import { httpError } from '../utils/httpError.js'

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
      throw httpError(401, 'Invalid credentials')
    }

    console.log('[LOGIN] Comparing password...')
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log('[LOGIN] Password valid:', isValid)
    
    if (!isValid) {
      throw httpError(401, 'Invalid credentials')
    }

    // Temporarily block student logins as per requirement #7
    if (user.role === 'student') {
      console.log('[LOGIN] Student login blocked')
      throw httpError(403, 'Student login is temporarily disabled. Please contact the administrator.')
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
