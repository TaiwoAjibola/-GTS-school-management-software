import { Router } from 'express'
import {
	bulkUploadResults,
	bulkUploadResultsFromFile,
	exportCourseResultsCsv,
	exportBatchCourseResultsTemplate,
	getBatchResults,
	getCourseResults,
	getResultsHistory,
	getStudentResults,
	uploadResult,
} from '../controllers/resultController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'

const router = Router()

router.use(authenticate)
router.post('/', authorize('lecturer', 'admin'), uploadResult)
router.post('/bulk', authorize('lecturer', 'admin'), bulkUploadResults)
router.post('/bulk-upload', authorize('lecturer', 'admin'), upload.single('file'), bulkUploadResultsFromFile)
router.get('/template', authorize('lecturer', 'admin'), exportBatchCourseResultsTemplate)
router.get('/history', authorize('lecturer', 'admin'), getResultsHistory)
router.get('/course/:courseId', authorize('lecturer', 'admin'), getCourseResults)
router.get('/batch/:batchId', authorize('lecturer', 'admin'), getBatchResults)
router.get('/course/:courseId/export', authorize('lecturer', 'admin'), exportCourseResultsCsv)
router.get('/my', authorize('student'), getStudentResults)

export default router
