import { Router } from 'express'
import { healthCheck } from '../db/pool.js'
import authRoutes from './authRoutes.js'
import studentRoutes from './studentRoutes.js'
import courseRoutes from './courseRoutes.js'
import attendanceRoutes from './attendanceRoutes.js'
import assignmentRoutes from './assignmentRoutes.js'
import examRoutes from './examRoutes.js'
import resultRoutes from './resultRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import batchRoutes from './batchRoutes.js'
import enrollmentRoutes from './enrollmentRoutes.js'
import cohortRoutes from './cohortRoutes.js'
import coursePlanRoutes from './coursePlanRoutes.js'
import lecturerRoutes from './lecturerRoutes.js'
import settingsRoutes from './settingsRoutes.js'
import formRoutes from './formRoutes.js'
import emailProcessRoutes from './emailProcessRoutes.js'
import credentialRoutes from './credentialRoutes.js'
import reportRoutes from './reportRoutes.js'
import bookMinistryRoutes from './bookMinistryRoutes.js'

const router = Router()

// Public health check - no auth required (always 200 so Render/cron stay green)
router.get('/health', async (req, res) => {
  let database = 'unknown'
  try {
    const db = await healthCheck()
    database = db.database || db.status
  } catch {
    database = 'disconnected'
  }
  res.status(200).json({
    status: 'ok',
    service: 'SAMS API',
    database,
    timestamp: new Date().toISOString(),
  })
})

router.use('/auth', authRoutes)
router.use('/students', studentRoutes)
router.use('/courses', courseRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/assignments', assignmentRoutes)
router.use('/exams', examRoutes)
router.use('/results', resultRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/batches', batchRoutes)
router.use('/enrollments', enrollmentRoutes)
router.use('/cohorts', cohortRoutes)
router.use('/course-plans', coursePlanRoutes)
router.use('/lecturers', lecturerRoutes)
router.use('/settings', settingsRoutes)
router.use('/forms', formRoutes)
router.use('/email-processes', emailProcessRoutes)
router.use('/credentials', credentialRoutes)
router.use('/reports', reportRoutes)
router.use('/book-ministry', bookMinistryRoutes)

export default router
