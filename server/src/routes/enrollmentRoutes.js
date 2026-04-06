import { Router } from 'express'
import {
  enrollStudentToBatch,
  enrollStudentToCourse,
  getStudentHistory,
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
router.get('/candidates', authorize('admin', 'lecturer'), listEnrollmentCandidates)
router.get('/course/:courseId', authorize('admin', 'lecturer'), listEnrollmentsByCourse)
router.get('/batch/:batchId', authorize('admin', 'lecturer'), listEnrollmentsByBatch)
router.get('/student/:studentId/history', authorize('admin', 'lecturer'), getStudentHistory)
router.patch('/:enrollmentId/notes', authorize('admin', 'lecturer'), updateEnrollmentNotes)

export default router
