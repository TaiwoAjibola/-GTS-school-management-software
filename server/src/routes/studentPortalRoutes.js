import { Router } from 'express'
import {
  getStudyGuide,
  getEnrollments,
  getCourseAvailability,
  getCourseMaterials,
  getCourseSessions,
  getGraduationStatus,
  getMyReports,
} from '../controllers/studentPortalController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.use(authorize('student'))

router.get('/study-guide', getStudyGuide)
router.get('/enrollments', getEnrollments)
router.get('/course-availability', getCourseAvailability)
router.get('/courses/:courseId/materials', getCourseMaterials)
router.get('/courses/:courseId/sessions', getCourseSessions)
router.get('/graduation-status', getGraduationStatus)
router.get('/reports/me', getMyReports)

export default router
