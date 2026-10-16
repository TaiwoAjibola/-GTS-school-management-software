import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { supabase, ensureBucketExists } from '../services/supabaseClient.js'
import path from 'node:path'

const EMAIL_ASSETS_BUCKET = 'email-assets'

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) throw httpError(400, 'No image file provided')
    if (!supabase) {
      throw httpError(501, 'Supabase Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).')
    }

    await ensureBucketExists(EMAIL_ASSETS_BUCKET)

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png'
    const fileName = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`

    const { data, error } = await supabase.storage
      .from(EMAIL_ASSETS_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      })

    if (error) throw httpError(500, `Failed to upload image: ${error.message}`)

    const { data: publicData } = supabase.storage
      .from(EMAIL_ASSETS_BUCKET)
      .getPublicUrl(data.path)

    res.json({ url: publicData.publicUrl })
  } catch (error) {
    next(error)
  }
}
