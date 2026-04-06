import { Router } from 'express'
import authRoutes from './authRoutes.js'
import studentRoutes from './studentRoutes.js'
import courseRoutes from './courseRoutes.js'
import attendanceRoutes from './attendanceRoutes.js'
import assignmentRoutes from './assignmentRoutes.js'
import resultRoutes from './resultRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import batchRoutes from './batchRoutes.js'
import enrollmentRoutes from './enrollmentRoutes.js'
import cohortRoutes from './cohortRoutes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SAMS API' })
})

router.use('/auth', authRoutes)
router.use('/students', studentRoutes)
router.use('/courses', courseRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/assignments', assignmentRoutes)
router.use('/results', resultRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/batches', batchRoutes)
router.use('/enrollments', enrollmentRoutes)
router.use('/cohorts', cohortRoutes)

export default router
