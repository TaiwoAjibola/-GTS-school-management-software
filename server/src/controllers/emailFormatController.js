import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ── List all email formats (defaults first) ─────────────────────────
export const listFormats = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ef.id, ef.name, ef.description, ef.html, ef.is_default,
              u.full_name AS creator_name, ef.created_at, ef.updated_at
       FROM email_formats ef
       LEFT JOIN users u ON u.id = ef.created_by
       ORDER BY ef.is_default DESC, ef.updated_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Get a single format ─────────────────────────────────────────────
export const getFormat = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM email_formats WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Format not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Create a new format ─────────────────────────────────────────────
export const createFormat = async (req, res, next) => {
  try {
    const { name, description, html } = req.body
    if (!name || !html) throw httpError(400, 'name and html are required')

    const result = await query(
      `INSERT INTO email_formats (name, description, html, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || '', html, req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update a format ─────────────────────────────────────────────────
export const updateFormat = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description, html } = req.body

    const result = await query(
      `UPDATE email_formats
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           html = COALESCE($3, html),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, description, html, id]
    )
    if (!result.rows.length) throw httpError(404, 'Format not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Delete a format (defaults are protected) ────────────────────────
export const deleteFormat = async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await query('SELECT is_default FROM email_formats WHERE id = $1', [id])
    if (!existing.rows.length) throw httpError(404, 'Format not found')
    if (existing.rows[0].is_default) {
      throw httpError(400, 'Default formats cannot be deleted')
    }
    await query('DELETE FROM email_formats WHERE id = $1', [id])
    res.json({ message: 'Format deleted' })
  } catch (error) {
    next(error)
  }
}
