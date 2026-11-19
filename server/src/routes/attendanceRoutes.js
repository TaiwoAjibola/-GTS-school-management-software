import { Router } from 'express'
import {
  closeAttendanceSession,
  closeBatchAttendanceSession,
  deleteAttendanceSession,
  editSessionAttendance,
  getCourseAttendanceHistory,
  getCourseAttendanceStudentSummary,
  getCourseAttendanceStatus,
  getBatchAttendanceStatus,
  getCourseAttendanceRoster,
  getCourseLiveClasses,
  getSessionRoster,
  getStudentAttendanceProgress,
  manualMarkAttendance,
  manualMarkBatchAttendance,
  markAttendance,
  startAttendanceSession,
  startLiveAttendance,
  getAttendanceSessionLiveStatus,
  getActiveLiveClass,
  getLiveClassJoinSignature,
  markLmsJoin,
  extendLiveAttendance,
  startBatchAttendanceSession,
  upsertCourseLiveClasses,
} from '../controllers/attendanceController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.post('/start', authorize('lecturer', 'admin'), startAttendanceSession)
router.post('/start-live', authorize('lecturer', 'admin'), startLiveAttendance)
router.get('/course/:courseId/live-class', getActiveLiveClass)
router.get('/course/:courseId/live-classes', getCourseLiveClasses)
router.put('/course/:courseId/live-classes', authorize('lecturer', 'admin'), upsertCourseLiveClasses)
router.get('/live-class/:sessionId/status', getAttendanceSessionLiveStatus)
router.get('/live-class/:sessionId/join-signature', getLiveClassJoinSignature)
router.post('/mark-lms-join', authorize('student'), markLmsJoin)
router.patch('/live-class/:sessionId/extend', authorize('lecturer', 'admin'), extendLiveAttendance)
router.post('/close', authorize('lecturer', 'admin'), closeAttendanceSession)
router.get('/course/:courseId/status', getCourseAttendanceStatus)
router.get('/course/:courseId/history', authorize('lecturer', 'admin'), getCourseAttendanceHistory)
router.get('/course/:courseId/students-summary', authorize('lecturer', 'admin'), getCourseAttendanceStudentSummary)
router.get('/course/:courseId/roster', authorize('lecturer', 'admin'), getCourseAttendanceRoster)
router.post('/manual-mark', authorize('lecturer', 'admin'), manualMarkAttendance)
router.get('/session/:sessionId/roster', authorize('lecturer', 'admin'), getSessionRoster)
router.patch('/session/:sessionId/toggle', authorize('lecturer', 'admin'), editSessionAttendance)
router.delete('/session/:sessionId', authorize('lecturer', 'admin'), deleteAttendanceSession)
router.post('/batch/start', authorize('lecturer', 'admin'), startBatchAttendanceSession)
router.post('/batch/close', authorize('lecturer', 'admin'), closeBatchAttendanceSession)
router.get('/batch/:batchId/status', authorize('lecturer', 'admin'), getBatchAttendanceStatus)
router.post('/batch/manual-mark', authorize('lecturer', 'admin'), manualMarkBatchAttendance)
router.post('/mark', authorize('student'), markAttendance)
router.get('/course/:courseId/progress', authorize('student'), getStudentAttendanceProgress)

export default router
