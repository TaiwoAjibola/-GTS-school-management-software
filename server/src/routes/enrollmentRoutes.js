import { Router } from 'express'
import {
  enrollStudentToBatch,
  enrollStudentToCourse,
  bulkEnrollStudents,
  copyEnrollmentsFromCourse,
  getStudentHistory,
  getStudentTimeline,
  autoCompleteEnrollments,
  autoEnrollStudents,
  listEnrollmentCandidates,
  listEnrollmentsByBatch,
  listEnrollmentsByCourse,
  updateEnrollmentNotes,
} from '../controllers/enrollmentController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.post('/', authorize('admin', 'lecturer'), enrollStudentToBatch)
router.post('/enroll', authorize('admin', 'lecturer'), enrollStudentToCourse)
router.post('/enroll-bulk', authorize('admin', 'lecturer'), bulkEnrollStudents)
router.post('/copy-from-course', authorize('admin', 'lecturer'), copyEnrollmentsFromCourse)
router.get('/candidates', authorize('admin', 'lecturer'), listEnrollmentCandidates)
router.get('/course/:courseId', authorize('admin', 'lecturer'), listEnrollmentsByCourse)
router.get('/batch/:batchId', authorize('admin', 'lecturer'), listEnrollmentsByBatch)
router.get('/student/:studentId/history', authorize('admin', 'lecturer'), getStudentHistory)
router.get('/student/:studentId/timeline', authorize('admin', 'lecturer'), getStudentTimeline)
router.post('/auto-complete', authorize('admin'), autoCompleteEnrollments)
router.post('/auto-enroll', authorize('admin'), autoEnrollStudents)
router.patch('/:enrollmentId/notes', authorize('admin', 'lecturer'), updateEnrollmentNotes)

export default router
