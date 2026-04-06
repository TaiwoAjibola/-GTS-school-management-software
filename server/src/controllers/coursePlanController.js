import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

export const listPlans = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cp.id, cp.name, cp.year, cp.created_at,
              COUNT(cpi.id)::int AS item_count
       FROM course_plans cp
       LEFT JOIN course_plan_items cpi ON cpi.plan_id = cp.id
       GROUP BY cp.id
       ORDER BY cp.year DESC, cp.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createPlan = async (req, res, next) => {
  try {
    const { name, year } = req.body
    if (!name || !year) throw httpError(400, 'name and year are required')

    const result = await query(
      `INSERT INTO course_plans (name, year, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), Number(year), req.user.userId]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getPlan = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    if (!planId) throw httpError(400, 'Invalid planId')

    const planResult = await query(`SELECT * FROM course_plans WHERE id = $1`, [planId])
    if (!planResult.rows.length) throw httpError(404, 'Plan not found')

    const itemsResult = await query(
      `SELECT cpi.id, cpi.course_id, cpi.start_date, cpi.end_date, cpi.sort_order, cpi.notes,
              c.title AS course_title, c.course_code, c.lecturer_name, c.duration_weeks
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.plan_id = $1
       ORDER BY cpi.start_date ASC NULLS LAST, cpi.sort_order ASC`,
      [planId]
    )

    res.json({ ...planResult.rows[0], items: itemsResult.rows })
  } catch (error) {
    next(error)
  }
}

export const deletePlan = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    if (!planId) throw httpError(400, 'Invalid planId')
    await query(`DELETE FROM course_plans WHERE id = $1`, [planId])
    res.json({ message: 'Plan deleted' })
  } catch (error) {
    next(error)
  }
}

export const addPlanItem = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    const { courseId, startDate, endDate, notes } = req.body
    if (!planId || !courseId) throw httpError(400, 'planId and courseId are required')

    const countRes = await query(`SELECT COUNT(*)::int AS c FROM course_plan_items WHERE plan_id = $1`, [planId])
    const sortOrder = countRes.rows[0].c

    const result = await query(
      `INSERT INTO course_plan_items (plan_id, course_id, start_date, end_date, sort_order, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [planId, courseId, startDate || null, endDate || null, sortOrder, notes || null]
    )

    const item = await query(
      `SELECT cpi.id, cpi.course_id, cpi.start_date, cpi.end_date, cpi.sort_order, cpi.notes,
              c.title AS course_title, c.course_code, c.lecturer_name, c.duration_weeks
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.id = $1`,
      [result.rows[0].id]
    )
    res.status(201).json(item.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updatePlanItem = async (req, res, next) => {
  try {
    const { planId, itemId } = req.params
    const { startDate, endDate, notes } = req.body
    await query(
      `UPDATE course_plan_items SET start_date = $1, end_date = $2, notes = $3 WHERE id = $4 AND plan_id = $5`,
      [startDate || null, endDate || null, notes || null, itemId, planId]
    )
    res.json({ message: 'Item updated' })
  } catch (error) {
    next(error)
  }
}

export const removePlanItem = async (req, res, next) => {
  try {
    const { planId, itemId } = req.params
    await query(`DELETE FROM course_plan_items WHERE id = $1 AND plan_id = $2`, [itemId, planId])
    res.json({ message: 'Item removed' })
  } catch (error) {
    next(error)
  }
}
