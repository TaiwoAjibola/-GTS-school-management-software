import { Router } from 'express'
import {
  listProcesses,
  getProcess,
  updateProcess,
  toggleProcess,
  archiveProcess,
  duplicateProcess,
  previewProcess,
  manualSend,
  sendTestEmail,
  listVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  listCommunicationLog,
} from '../controllers/emailProcessController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Core CRUD
router.get('/', authorize('admin', 'lecturer'), listProcesses)
router.get('/:id', authorize('admin', 'lecturer'), getProcess)
router.patch('/:id', authorize('admin'), updateProcess)
router.patch('/:id/toggle', authorize('admin'), toggleProcess)

// Archive & duplicate
router.patch('/:id/archive', authorize('admin'), archiveProcess)
router.post('/:id/duplicate', authorize('admin'), duplicateProcess)

// Preview & send
router.get('/:id/preview', authorize('admin', 'lecturer'), previewProcess)
router.post('/:id/send', authorize('admin'), manualSend)
router.post('/:id/test', authorize('admin'), sendTestEmail)

// Template variables CRUD
router.get('/:processId/variables', authorize('admin', 'lecturer'), listVariables)
router.post('/:processId/variables', authorize('admin'), createVariable)
router.patch('/variables/:variableId', authorize('admin'), updateVariable)
router.delete('/variables/:variableId', authorize('admin'), deleteVariable)

// Communication log
router.get('/log/all', authorize('admin'), listCommunicationLog)

export default router
