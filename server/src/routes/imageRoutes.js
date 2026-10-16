import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { uploadImage } from '../controllers/imageController.js'

const router = Router()

router.use(authenticate)

router.post('/upload', authorize('admin', 'lecturer'), upload.single('file'), uploadImage)

export default router
