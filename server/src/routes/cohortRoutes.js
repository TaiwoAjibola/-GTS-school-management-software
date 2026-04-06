import { Router } from 'express'
import {
	listCohorts,
	createCohort,
	updateCohort,
	getCohortStudents,
	reorderCohorts,
	deleteCohort,
} from '../controllers/cohortController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listCohorts)
router.post('/', authorize('admin', 'lecturer'), createCohort)
router.patch('/reorder', authorize('admin', 'lecturer'), reorderCohorts)
router.patch('/:cohortId', authorize('admin', 'lecturer'), updateCohort)
router.delete('/:cohortId', authorize('admin', 'lecturer'), deleteCohort)
router.get('/:cohortId/students', authorize('admin', 'lecturer'), getCohortStudents)

export default router
