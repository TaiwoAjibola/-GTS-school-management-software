import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { sendCourseMaterialEmail } from '../services/emailService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsRoot = path.join(__dirname, '../../uploads/materials')

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true })
}

export const listCourseMaterials = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Valid courseId is required')

    const result = await query(
      `SELECT cm.id,
              cm.course_id,
              cm.title,
              cm.description,
              cm.section_number,
              cm.material_type,
              cm.material_url,
              cm.content,
              cm.created_at,
              cm.created_by,
              u.full_name AS created_by_name,
              c.title AS course_title
       FROM course_materials cm
       LEFT JOIN users u ON u.id = cm.created_by
       JOIN courses c ON c.id = cm.course_id
       WHERE cm.course_id = $1
       ORDER BY COALESCE(cm.section_number, 999999) ASC, cm.created_at DESC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createCourseMaterial = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Valid courseId is required')

    const { title, description, sectionNumber, materialType, content } = req.body
    if (!title?.trim()) {
      throw httpError(400, 'Material title is required')
    }

    const normalizedType = materialType === 'text' ? 'text' : 'file'
    let materialUrl = null
    let materialContent = null

    if (normalizedType === 'text') {
      if (!content?.trim()) {
        throw httpError(400, 'Text content is required for text materials')
      }
      materialContent = content.trim()
    } else {
      if (!req.file) {
        throw httpError(400, 'A file is required for file materials')
      }
      const safeName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`
      const targetPath = path.join(uploadsRoot, safeName)
      fs.writeFileSync(targetPath, req.file.buffer)
      materialUrl = `/uploads/materials/${safeName}`
    }

    const insertResult = await query(
      `INSERT INTO course_materials (course_id, title, description, section_number, material_type, material_url, content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        courseId,
        title.trim(),
        description?.trim() || null,
        sectionNumber ? Number(sectionNumber) : null,
        normalizedType,
        materialUrl,
        materialContent,
        req.user.userId,
      ]
    )

    res.status(201).json(insertResult.rows[0])
  } catch (error) {
    next(error)
  }
}

export const sendCourseMaterialToActiveStudents = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const materialId = Number(req.params.materialId)
    if (!courseId || !materialId) throw httpError(400, 'Valid courseId and materialId are required')

    const materialResult = await query(
      `SELECT cm.id, cm.title, cm.description, cm.material_type, cm.material_url, cm.content, cm.section_number, c.title AS course_title
       FROM course_materials cm
       JOIN courses c ON c.id = cm.course_id
       WHERE cm.id = $1 AND cm.course_id = $2`,
      [materialId, courseId]
    )

    const material = materialResult.rows[0]
    if (!material) throw httpError(404, 'Course material not found')

    const activeStudentsResult = await query(
      `SELECT s.id AS student_id, u.full_name, u.email
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       WHERE e.course_id = $1 AND e.status = 'active'
       ORDER BY u.full_name ASC`,
      [courseId]
    )

    let sentCount = 0
    const absoluteMaterialUrl = material.material_url
      ? `${req.protocol}://${req.get('host')}${material.material_url}`
      : null
    for (const student of activeStudentsResult.rows) {
      const sent = await sendCourseMaterialEmail({
        to: student.email,
        studentName: student.full_name,
        courseTitle: material.course_title,
        materialTitle: material.title,
        materialDescription: material.description,
        sectionNumber: material.section_number,
        materialUrl: absoluteMaterialUrl,
        materialType: material.material_type,
        content: material.content,
      }).catch(() => false)

      if (sent) sentCount += 1
    }

    res.json({
      deliveredTo: activeStudentsResult.rows.length,
      emailed: sentCount,
    })
  } catch (error) {
    next(error)
  }
}
