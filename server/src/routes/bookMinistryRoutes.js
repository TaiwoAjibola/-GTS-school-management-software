import { Router } from 'express'
import {
  getSettings,
  updateSetting,
  listLinkedAccounts,
  linkAccount,
  unlinkAccount,
  listBorrowingHistory,
  createBorrowingRecord,
  updateBorrowingRecord,
  listReadingRecords,
  createReadingRecord,
  updateReadingRecord,
  listPermissions,
  grantPermission,
  revokePermission,
  listAccessRules,
  updateAccessRule,
  getDashboardStats,
  listBookRequests,
  updateBookRequest,
} from '../controllers/bookMinistryController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Dashboard stats
router.get('/stats', authorize('admin', 'lecturer'), getDashboardStats)

// Settings
router.get('/settings', authorize('admin', 'lecturer'), getSettings)
router.patch('/settings', authorize('admin'), updateSetting)

// Linked accounts
router.get('/linked-accounts', authorize('admin', 'lecturer'), listLinkedAccounts)
router.post('/linked-accounts', authorize('admin'), linkAccount)
router.delete('/linked-accounts/:id', authorize('admin'), unlinkAccount)

// Borrowing history
router.get('/borrowing', authorize('admin', 'lecturer'), listBorrowingHistory)
router.post('/borrowing', authorize('admin', 'lecturer'), createBorrowingRecord)
router.patch('/borrowing/:id', authorize('admin', 'lecturer'), updateBorrowingRecord)

// Reading records
router.get('/reading', authorize('admin', 'lecturer'), listReadingRecords)
router.post('/reading', authorize('admin', 'lecturer'), createReadingRecord)
router.patch('/reading/:id', authorize('admin', 'lecturer'), updateReadingRecord)

// Library permissions
router.get('/permissions', authorize('admin', 'lecturer'), listPermissions)
router.post('/permissions', authorize('admin'), grantPermission)
router.patch('/permissions/:id/revoke', authorize('admin'), revokePermission)

// Access rules
router.get('/access-rules', authorize('admin', 'lecturer'), listAccessRules)
router.patch('/access-rules/:id', authorize('admin'), updateAccessRule)

// Book requests (from migration 012)
router.get('/requests', authorize('admin', 'lecturer'), listBookRequests)
router.patch('/requests/:id', authorize('admin', 'lecturer'), updateBookRequest)

export default router
