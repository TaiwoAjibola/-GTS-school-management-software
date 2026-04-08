import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

export const listLecturers = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, created_at FROM lecturers ORDER BY name ASC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createLecturer = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body
    if (!name || !name.trim()) throw httpError(400, 'name is required')

    const result = await query(
      `INSERT INTO lecturers (name, email, phone) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), email?.trim() || null, phone?.trim() || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateLecturer = async (req, res, next) => {
  try {
    const lecturerId = Number(req.params.lecturerId)
    if (!lecturerId) throw httpError(400, 'Invalid lecturerId')

    const existing = await query(`SELECT * FROM lecturers WHERE id = $1`, [lecturerId])
    if (!existing.rows.length) throw httpError(404, 'Lecturer not found')
    const l = existing.rows[0]

    const {
      name = l.name,
      email = l.email,
      phone = l.phone,
    } = req.body

    if (!name || !name.trim()) throw httpError(400, 'name is required')

    const result = await query(
      `UPDATE lecturers SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *`,
      [name.trim(), email?.trim() || null, phone?.trim() || null, lecturerId]
    )
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const deleteLecturer = async (req, res, next) => {
  try {
    const lecturerId = Number(req.params.lecturerId)
    if (!lecturerId) throw httpError(400, 'Invalid lecturerId')

    await query(`DELETE FROM lecturers WHERE id = $1`, [lecturerId])
    res.json({ message: 'Lecturer deleted' })
  } catch (error) {
    next(error)
  }
}
