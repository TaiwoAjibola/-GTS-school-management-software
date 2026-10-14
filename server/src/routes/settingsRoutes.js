import { Router } from 'express'
import {
  getAllSettings,
  getPublicSettings,
  getSetting,
  updateSetting,
  updateSettingsBulk,
} from '../controllers/settingsController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Public, safe branding read — no secrets, no auth required.
router.get('/public', getPublicSettings)

router.use(authenticate)
router.get('/', authorize('admin'), getAllSettings)
router.get('/:key', authorize('admin'), getSetting)
router.patch('/:key', authorize('admin'), updateSetting)
router.patch('/', authorize('admin'), updateSettingsBulk)

export default router
