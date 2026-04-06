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
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw httpError(400, 'Email and password are required')
    }

    const result = await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])

    const user = result.rows[0]
    if (!user) {
      throw httpError(401, 'Invalid credentials')
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      throw httpError(401, 'Invalid credentials')
    }

    if (user.role !== 'admin') {
      throw httpError(403, 'Access restricted to administrators only')
    }

    const token = createToken(user)

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
