import { Router } from 'express'
import {
	createStudent,
	downloadStudentTemplate,
	enrollStudent,
	exportStudents,
	getGraduationMatrix,
	getStudent,
	listStudents,
	updateStudent,
	uploadStudents,
	addStudentStatus,
	removeStudentStatus,
	uploadStudentPhoto,
	updateStudentLifecycleStatus,
} from '../controllers/studentController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listStudents)
router.get('/export', authorize('admin', 'lecturer'), exportStudents)
router.get('/graduation-matrix', authorize('admin', 'lecturer'), getGraduationMatrix)
router.get('/template', authorize('admin', 'lecturer'), downloadStudentTemplate)
router.post('/', authorize('admin', 'lecturer'), createStudent)
router.post('/enroll', authorize('admin', 'lecturer'), enrollStudent)
router.post('/upload', authorize('admin', 'lecturer'), upload.single('file'), uploadStudents)
router.get('/:studentId', authorize('admin', 'lecturer'), getStudent)
router.put('/:studentId', authorize('admin', 'lecturer'), updateStudent)
router.patch('/:studentId/lifecycle-status', authorize('admin'), updateStudentLifecycleStatus)
router.post('/:studentId/photo', authorize('admin', 'lecturer'), upload.single('file'), uploadStudentPhoto)
router.post('/:studentId/status', authorize('admin', 'lecturer'), addStudentStatus)
router.delete('/:studentId/status/:statusId', authorize('admin', 'lecturer'), removeStudentStatus)

export default router
