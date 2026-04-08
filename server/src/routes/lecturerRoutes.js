import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  listLecturers,
  createLecturer,
  updateLecturer,
  deleteLecturer,
} from '../controllers/lecturerController.js'

const router = Router()

router.use(authenticate)
router.get('/', listLecturers)
router.post('/', authorize('admin', 'lecturer'), createLecturer)
router.put('/:lecturerId', authorize('admin', 'lecturer'), updateLecturer)
router.delete('/:lecturerId', authorize('admin', 'lecturer'), deleteLecturer)

export default router
