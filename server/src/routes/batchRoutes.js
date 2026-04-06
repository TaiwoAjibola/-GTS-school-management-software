import { Router } from 'express'
import {
  completeBatch,
  createBatch,
  getBatchDetails,
  listBatches,
  setCurrentBatch,
  suspendBatch,
  updateBatch,
} from '../controllers/batchController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listBatches)
router.post('/', authorize('admin', 'lecturer'), createBatch)
router.get('/:batchId', authorize('admin', 'lecturer'), getBatchDetails)
router.post('/:batchId/suspend', authorize('admin'), suspendBatch)
router.post('/:batchId/complete', authorize('admin', 'lecturer'), completeBatch)
router.patch('/:batchId/set-current', authorize('admin', 'lecturer'), setCurrentBatch)
router.patch('/:batchId', authorize('admin', 'lecturer'), updateBatch)

export default router
