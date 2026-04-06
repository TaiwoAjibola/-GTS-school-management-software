import { Router } from 'express'
import {
	createAssignment,
	getAssignmentEligibleStudents,
	getAssignmentEligibleStudentsByBatch,
	getCourseAssignments,
	getStudentAssignments,
} from '../controllers/assignmentController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

router.use(authenticate)
router.get('/eligible/:courseId', authorize('lecturer', 'admin'), getAssignmentEligibleStudents)
router.get('/eligible/batch/:batchId', authorize('lecturer', 'admin'), getAssignmentEligibleStudentsByBatch)
router.get('/course/:courseId', authorize('lecturer', 'admin'), getCourseAssignments)
router.post('/', authorize('lecturer', 'admin'), upload.single('file'), createAssignment)
router.get('/my', authorize('student'), getStudentAssignments)

export default router
