import { Router } from 'express'
import {
  getAllSettings,
  getSetting,
  updateSetting,
  updateSettingsBulk,
} from '../controllers/settingsController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin'), getAllSettings)
router.get('/:key', authorize('admin'), getSetting)
router.patch('/:key', authorize('admin'), updateSetting)
router.patch('/', authorize('admin'), updateSettingsBulk)

export default router
