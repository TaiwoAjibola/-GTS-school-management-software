import express from 'express'
import * as reportController from '../controllers/reportController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// Only admins and lecturers should see reports
router.get('/general', authenticate, authorize('admin', 'lecturer'), reportController.getGeneralReports)
router.get('/attendance', authenticate, authorize('admin', 'lecturer'), reportController.getAttendanceReports)

export default router
