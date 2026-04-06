import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import routes from './routes/index.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const allowedOrigins = new Set([
  ...env.clientUrls,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5189',
  'http://127.0.0.1:5189',
])

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true,
  })
)
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

export default app
