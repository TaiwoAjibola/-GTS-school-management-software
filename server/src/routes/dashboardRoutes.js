import { Router } from 'express'
import { adminAnalytics } from '../controllers/dashboardController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.get('/admin-analytics', authorize('admin'), adminAnalytics)

export default router
