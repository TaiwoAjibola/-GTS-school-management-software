import { Router } from 'express'
import {
  listProcesses,
  getProcess,
  updateProcess,
  toggleProcess,
  sendTestEmail,
} from '../controllers/emailProcessController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listProcesses)
router.get('/:id', authorize('admin', 'lecturer'), getProcess)
router.patch('/:id', authorize('admin'), updateProcess)
router.patch('/:id/toggle', authorize('admin'), toggleProcess)
router.post('/:id/test', authorize('admin'), sendTestEmail)

export default router
