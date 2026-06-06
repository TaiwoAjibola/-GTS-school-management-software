import { Router } from 'express'
import {
  listProcesses,
  getProcess,
  createProcess,
  updateProcess,
  deleteProcess,
  duplicateProcess,
  previewProcess,
  previewWithStudent,
  sendTemplate,
  getSendStatus,
  listGlobalVariables,
  listVariableCategories,
  listCommunicationLog,
} from '../controllers/emailProcessController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Template CRUD
router.get('/', authorize('admin', 'lecturer'), listProcesses)
router.post('/', authorize('admin'), createProcess)
router.get('/:id', authorize('admin', 'lecturer'), getProcess)
router.patch('/:id', authorize('admin'), updateProcess)
router.delete('/:id', authorize('admin'), deleteProcess)

// Duplicate
router.post('/:id/duplicate', authorize('admin'), duplicateProcess)

// Preview & send
router.get('/:id/preview', authorize('admin', 'lecturer'), previewProcess)
router.get('/:id/preview/:studentId', authorize('admin', 'lecturer'), previewWithStudent)
router.post('/:id/send', authorize('admin'), sendTemplate)
router.get('/send-status/:jobId', authorize('admin', 'lecturer'), getSendStatus)

// Global variable library
router.get('/variables/all', authorize('admin', 'lecturer'), listGlobalVariables)
router.get('/variables/categories', authorize('admin', 'lecturer'), listVariableCategories)

// Communication log
router.get('/log/all', authorize('admin'), listCommunicationLog)

export default router
