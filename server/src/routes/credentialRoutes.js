import { Router } from 'express'
import {
  listCredentials,
  resetPassword,
  toggleActive,
  createCredential,
  updateRole,
} from '../controllers/credentialController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.use(authorize('admin')) // Only admins can manage credentials

router.get('/', listCredentials)
router.post('/', createCredential)
router.patch('/:userId/password', resetPassword)
router.patch('/:userId/toggle-active', toggleActive)
router.patch('/:userId/role', updateRole)

export default router
