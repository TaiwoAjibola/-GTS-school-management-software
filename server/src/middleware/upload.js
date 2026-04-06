import multer from 'multer'

const memoryStorage = multer.memoryStorage()

export const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})
