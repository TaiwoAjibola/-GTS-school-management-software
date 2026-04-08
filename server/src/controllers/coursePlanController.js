import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

export const getActivePlan = async (req, res, next) => {
  try {
    const planResult = await query(`SELECT * FROM course_plans WHERE is_active = TRUE LIMIT 1`)
    if (!planResult.rows.length) return res.json(null)

    const plan = planResult.rows[0]
    const itemsResult = await query(
      `SELECT cpi.id, cpi.course_id, cpi.start_date, cpi.end_date, cpi.sort_order, cpi.notes,
              c.title AS course_title, c.course_code, c.lecturer_name, c.duration_weeks
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.plan_id = $1
       ORDER BY cpi.start_date ASC NULLS LAST, cpi.sort_order ASC`,
      [plan.id]
    )

    res.json({ ...plan, items: itemsResult.rows })
  } catch (error) {
    next(error)
  }
}

export const listPlans = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cp.id, cp.name, cp.year, cp.is_active, cp.created_at,
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

export const setActivePlan = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    if (!planId) throw httpError(400, 'Invalid planId')

    const existing = await query(`SELECT id FROM course_plans WHERE id = $1`, [planId])
    if (!existing.rows.length) throw httpError(404, 'Plan not found')

    // Clear all active flags then set this one
    await query(`UPDATE course_plans SET is_active = FALSE`)
    await query(`UPDATE course_plans SET is_active = TRUE WHERE id = $1`, [planId])

    res.json({ message: 'Active plan updated', planId })
  } catch (error) {
    next(error)
  }
}

export const updatePlan = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    if (!planId) throw httpError(400, 'Invalid planId')

    const { name, year } = req.body
    if (!name || !year) throw httpError(400, 'name and year are required')

    const result = await query(
      `UPDATE course_plans SET name = $1, year = $2 WHERE id = $3 RETURNING *`,
      [name.trim(), Number(year), planId]
    )
    if (!result.rows.length) throw httpError(404, 'Plan not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// Returns students eligible to enroll in courses under a given plan.
// Rule: cohorts whose start year is plan_year or plan_year-1, PLUS students
// who have at least one failed enrolment (re-enrollees from any previous year).
export const getEligibleStudents = async (req, res, next) => {
  try {
    const planId = Number(req.params.planId)
    if (!planId) throw httpError(400, 'Invalid planId')

    const planResult = await query(`SELECT year FROM course_plans WHERE id = $1`, [planId])
    if (!planResult.rows.length) throw httpError(404, 'Plan not found')
    const planYear = Number(planResult.rows[0].year)

    // Students from cohorts matching plan year and plan year - 1
    const cohortStudents = await query(
      `SELECT DISTINCT s.id, u.full_name, s.matric_no, c.name AS cohort_name,
              EXTRACT(YEAR FROM c.start_date)::int AS cohort_year,
              'cohort' AS reason
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN cohorts c ON c.id = s.cohort_id
       WHERE c.start_date IS NOT NULL
         AND EXTRACT(YEAR FROM c.start_date) IN ($1, $2)
         AND s.status = 'Active'`,
      [planYear, planYear - 1]
    )

    // Students with at least one failed enrolment not in the above cohort range
    const failedStudents = await query(
      `SELECT DISTINCT s.id, u.full_name, s.matric_no,
              COALESCE(c.name, 'No cohort') AS cohort_name,
              EXTRACT(YEAR FROM COALESCE(c.start_date, NOW()))::int AS cohort_year,
              'failed_reenroll' AS reason
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN cohorts c ON c.id = s.cohort_id
       WHERE s.status = 'Active'
         AND EXISTS (
           SELECT 1 FROM results r WHERE r.student_id = s.id AND r.status = 'Fail'
         )
         AND (
           c.id IS NULL
           OR c.start_date IS NULL
           OR EXTRACT(YEAR FROM c.start_date) NOT IN ($1, $2)
         )`,
      [planYear, planYear - 1]
    )

    const seen = new Set(cohortStudents.rows.map((r) => r.id))
    const combined = [
      ...cohortStudents.rows,
      ...failedStudents.rows.filter((r) => !seen.has(r.id)),
    ]

    res.json({ planYear, students: combined })
  } catch (error) {
    next(error)
  }
}
