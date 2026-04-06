import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  listPlans,
  createPlan,
  getPlan,
  deletePlan,
  addPlanItem,
  updatePlanItem,
  removePlanItem,
} from '../controllers/coursePlanController.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listPlans)
router.post('/', authorize('admin', 'lecturer'), createPlan)
router.get('/:planId', authorize('admin', 'lecturer'), getPlan)
router.delete('/:planId', authorize('admin', 'lecturer'), deletePlan)
router.post('/:planId/items', authorize('admin', 'lecturer'), addPlanItem)
router.put('/:planId/items/:itemId', authorize('admin', 'lecturer'), updatePlanItem)
router.delete('/:planId/items/:itemId', authorize('admin', 'lecturer'), removePlanItem)

export default router
