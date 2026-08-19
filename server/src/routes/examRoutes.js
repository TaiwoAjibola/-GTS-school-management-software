import { Router } from 'express'
import {
  createExam,
  deleteExam,
  getExamEligibleStudents,
  getExamEligibleStudentsByBatch,
  getStudentExams,
  listExamsByCourse,
  sendExam,
} from '../controllers/examController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/eligible/:courseId', authorize('lecturer', 'admin'), getExamEligibleStudents)
router.get('/eligible/batch/:batchId', authorize('lecturer', 'admin'), getExamEligibleStudentsByBatch)
router.get('/course/:courseId', authorize('lecturer', 'admin'), listExamsByCourse)
router.get('/my', authorize('student'), getStudentExams)
router.post('/', authorize('lecturer', 'admin'), createExam)
router.post('/:examId/send', authorize('lecturer', 'admin'), sendExam)
router.delete('/:examId', authorize('lecturer', 'admin'), deleteExam)

export default router