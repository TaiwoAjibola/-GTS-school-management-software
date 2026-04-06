import { Router } from 'express'
import {
  closeAttendanceSession,
  closeBatchAttendanceSession,
  getCourseAttendanceHistory,
  getCourseAttendanceStudentSummary,
  getCourseAttendanceStatus,
  getBatchAttendanceStatus,
  getCourseAttendanceRoster,
  getStudentAttendanceProgress,
  manualMarkAttendance,
  manualMarkBatchAttendance,
  markAttendance,
  startAttendanceSession,
  startBatchAttendanceSession,
} from '../controllers/attendanceController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.post('/start', authorize('lecturer', 'admin'), startAttendanceSession)
router.post('/close', authorize('lecturer', 'admin'), closeAttendanceSession)
router.get('/course/:courseId/status', getCourseAttendanceStatus)
router.get('/course/:courseId/history', authorize('lecturer', 'admin'), getCourseAttendanceHistory)
router.get('/course/:courseId/students-summary', authorize('lecturer', 'admin'), getCourseAttendanceStudentSummary)
router.get('/course/:courseId/roster', authorize('lecturer', 'admin'), getCourseAttendanceRoster)
router.post('/manual-mark', authorize('lecturer', 'admin'), manualMarkAttendance)
router.post('/batch/start', authorize('lecturer', 'admin'), startBatchAttendanceSession)
router.post('/batch/close', authorize('lecturer', 'admin'), closeBatchAttendanceSession)
router.get('/batch/:batchId/status', authorize('lecturer', 'admin'), getBatchAttendanceStatus)
router.post('/batch/manual-mark', authorize('lecturer', 'admin'), manualMarkBatchAttendance)
router.post('/mark', authorize('student'), markAttendance)
router.get('/course/:courseId/progress', authorize('student'), getStudentAttendanceProgress)

export default router
