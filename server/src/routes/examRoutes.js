import { Router } from 'express'
import {
  createExam,
  deleteExam,
  getExamEligibleStudents,
  getExamEligibleStudentsByBatch,
  getStudentExams,
  listExamsByCourse,
  sendExam,
  getPublicQuiz,
  unlockPublicQuiz,
  submitPublicQuiz,
  listExamSubmissions,
  sendExamResults,
} from '../controllers/examController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Public MCQ take flow (no auth — access code identifies the student)
router.get('/public/:token', getPublicQuiz)
router.post('/public/:token/unlock', unlockPublicQuiz)
router.post('/public/:token/submit', submitPublicQuiz)

router.use(authenticate)
router.get('/eligible/:courseId', authorize('lecturer', 'admin'), getExamEligibleStudents)
router.get('/eligible/batch/:batchId', authorize('lecturer', 'admin'), getExamEligibleStudentsByBatch)
router.get('/course/:courseId', authorize('lecturer', 'admin'), listExamsByCourse)
router.get('/my', authorize('student'), getStudentExams)
router.get('/:examId/submissions', authorize('lecturer', 'admin'), listExamSubmissions)
router.post('/:examId/send-results', authorize('lecturer', 'admin'), sendExamResults)
router.post('/', authorize('lecturer', 'admin'), createExam)
router.post('/:examId/send', authorize('lecturer', 'admin'), sendExam)
router.delete('/:examId', authorize('lecturer', 'admin'), deleteExam)

export default router
