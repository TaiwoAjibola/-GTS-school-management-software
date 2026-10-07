import { Router } from 'express'
import {
	listGraduationSets,
	createGraduationSet,
	getGraduationSet,
	updateGraduationSet,
	deleteGraduationSet,
	addSetMembers,
	removeSetMember,
	addSetCourses,
	removeSetCourse,
	completeGraduationSet,
	exportSetReportXlsx,
	exportSetReportPdf,
} from '../controllers/graduatingSetController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listGraduationSets)
router.post('/', authorize('admin', 'lecturer'), createGraduationSet)
router.get('/:id/report.xlsx', authorize('admin', 'lecturer'), exportSetReportXlsx)
router.get('/:id/report.pdf', authorize('admin', 'lecturer'), exportSetReportPdf)
router.get('/:id', authorize('admin', 'lecturer'), getGraduationSet)
router.patch('/:id', authorize('admin', 'lecturer'), updateGraduationSet)
router.delete('/:id', authorize('admin', 'lecturer'), deleteGraduationSet)
router.post('/:id/members', authorize('admin', 'lecturer'), addSetMembers)
router.delete('/:id/members/:studentId', authorize('admin', 'lecturer'), removeSetMember)
router.post('/:id/courses', authorize('admin', 'lecturer'), addSetCourses)
router.delete('/:id/courses/:courseId', authorize('admin', 'lecturer'), removeSetCourse)
router.post('/:id/complete', authorize('admin', 'lecturer'), completeGraduationSet)

export default router
