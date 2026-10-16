import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  listFormats,
  getFormat,
  createFormat,
  updateFormat,
  deleteFormat,
} from '../controllers/emailFormatController.js'

const router = Router()

router.use(authenticate)

router.get('/', authorize('admin', 'lecturer'), listFormats)
router.post('/', authorize('admin'), createFormat)
router.get('/:id', authorize('admin', 'lecturer'), getFormat)
router.patch('/:id', authorize('admin'), updateFormat)
router.delete('/:id', authorize('admin'), deleteFormat)

export default router
