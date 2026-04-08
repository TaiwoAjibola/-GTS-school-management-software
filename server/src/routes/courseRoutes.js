import { Router } from 'express'
import {
	bulkUploadCourses,
	createCourse,
	deleteCourse,
	downloadCourseTemplate,
	getCourse,
	getCourseAllEnrollments,
	getCourseStudents,
	getStudentCourses,
	listCourses,
	setCurrentCourse,
	updateCourse,
} from '../controllers/courseController.js'
import {
	createCourseMaterial,
	listCourseMaterials,
	sendCourseMaterialToActiveStudents,
} from '../controllers/courseMaterialController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

router.use(authenticate)
router.get('/', listCourses)
router.get('/my-courses', authorize('student'), getStudentCourses)
router.get('/template', authorize('admin', 'lecturer'), downloadCourseTemplate)
router.post('/bulk-upload', authorize('admin', 'lecturer'), upload.single('file'), bulkUploadCourses)
router.get('/:courseId/students', authorize('admin', 'lecturer'), getCourseStudents)
router.get('/:courseId/materials', authorize('admin', 'lecturer'), listCourseMaterials)
router.post('/:courseId/materials', authorize('admin', 'lecturer'), upload.single('file'), createCourseMaterial)
router.post('/:courseId/materials/:materialId/send', authorize('admin', 'lecturer'), sendCourseMaterialToActiveStudents)
router.get('/:courseId/enrollments', authorize('admin', 'lecturer'), getCourseAllEnrollments)
router.get('/:courseId', authorize('admin', 'lecturer'), getCourse)
router.post('/', authorize('admin', 'lecturer'), createCourse)
router.patch('/:courseId/set-current', authorize('admin', 'lecturer'), setCurrentCourse)
router.patch('/:courseId', authorize('admin', 'lecturer'), updateCourse)
router.delete('/:courseId', authorize('admin', 'lecturer'), deleteCourse)

export default router
