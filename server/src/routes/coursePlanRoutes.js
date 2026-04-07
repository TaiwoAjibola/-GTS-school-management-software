import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import {
  listPlans,
  createPlan,
  getPlan,
  deletePlan,
  updatePlan,
  setActivePlan,
  getEligibleStudents,
  addPlanItem,
  updatePlanItem,
  removePlanItem,
} from '../controllers/coursePlanController.js'

const router = Router()

router.use(authenticate)
router.get('/', authorize('admin', 'lecturer'), listPlans)
router.post('/', authorize('admin', 'lecturer'), createPlan)
router.get('/:planId', authorize('admin', 'lecturer'), getPlan)
router.put('/:planId', authorize('admin', 'lecturer'), updatePlan)
router.delete('/:planId', authorize('admin', 'lecturer'), deletePlan)
router.patch('/:planId/set-active', authorize('admin', 'lecturer'), setActivePlan)
router.get('/:planId/eligible-students', authorize('admin', 'lecturer'), getEligibleStudents)
router.post('/:planId/items', authorize('admin', 'lecturer'), addPlanItem)
router.put('/:planId/items/:itemId', authorize('admin', 'lecturer'), updatePlanItem)
router.delete('/:planId/items/:itemId', authorize('admin', 'lecturer'), removePlanItem)

export default router
