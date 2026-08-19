import { Router } from 'express'
import {
  createForm,
  listForms,
  getForm,
  getFormBySlug,
  updateForm,
  deleteForm,
  submitForm,
  listSubmissions,
  getAllSubmissions,
  reviewSubmission,
  deleteSubmission,
  getProspectiveStudents,
  getFormAvailability,
} from '../controllers/formController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Public routes
router.get('/public/:slug/availability', getFormAvailability)
router.get('/public/:slug', getFormBySlug)
router.post('/submit', submitForm)

// Protected routes
router.use(authenticate)
router.post('/', authorize('admin', 'lecturer'), createForm)
router.get('/', authorize('admin', 'lecturer'), listForms)
router.get('/prospective-students', authorize('admin', 'lecturer'), getProspectiveStudents)
router.get('/submissions', authorize('admin', 'lecturer'), getAllSubmissions)
router.get('/:id', authorize('admin', 'lecturer'), getForm)
router.patch('/:id', authorize('admin', 'lecturer'), updateForm)
router.delete('/:id', authorize('admin'), deleteForm)
router.get('/:formId/submissions', authorize('admin', 'lecturer'), listSubmissions)
router.patch('/submissions/:submissionId/review', authorize('admin', 'lecturer'), reviewSubmission)
router.delete('/submissions/:submissionId', authorize('admin'), deleteSubmission)

export default router
