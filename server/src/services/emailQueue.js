import { query } from '../db/pool.js'

const jobs = new Map()
let nextSeq = 0

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 3000

export const createSendJob = (jobData) => {
  const id = `send_${Date.now()}_${nextSeq++}`
  const { recipients, processId, subjectTemplate, bodyTemplate, channel, senderId } = jobData

  const job = {
    id,
    status: 'queued',
    total: recipients.length,
    sent: 0,
    failed: 0,
    errors: [],
    message: 'Queued',
    recipients,
    processId,
    subjectTemplate,
    bodyTemplate,
    channel,
    senderId,
    createdAt: new Date().toISOString(),
    completedAt: null,
  }
  jobs.set(id, job)

  setImmediate(() => runJob(job).catch((err) => {
    console.error('[emailQueue] runJob crashed:', err)
    job.status = 'failed'
    job.message = err.message
  }))

  return id
}

export const getSendJobStatus = (jobId) => {
  const job = jobs.get(jobId)
  if (!job) return null

  const done = job.sent + job.failed
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    done,
    errors: job.errors,
    message: job.status === 'completed'
      ? `Sent to ${job.sent}/${job.total} recipients`
      : job.status === 'failed'
      ? job.message
      : `Sending ${done}/${job.total}...`,
  }
}

const runJob = async (job) => {
  job.status = 'running'

  const { sendRawEmail } = await import('./emailService.js')

  for (const rcpt of job.recipients) {
    let lastErr = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await sendRawEmail({ to: rcpt.email, subject: rcpt.subject, html: rcpt.body })
        job.sent++
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        }
      }
    }
    if (lastErr) {
      job.failed++
      job.errors.push(`${rcpt.email}: ${lastErr.message}`)
    }
  }

  job.status = 'completed'
  job.completedAt = new Date().toISOString()
  job.message = `Sent to ${job.sent}/${job.total} recipients`

  try {
    const subjectText = job.subjectTemplate
    const bodyText = job.bodyTemplate
    const status = job.errors.length === 0 ? 'sent' : job.sent > 0 ? 'partial' : 'failed'

    await query(
      `INSERT INTO communication_log
        (process_id, recipient_type, recipient_count, recipient_preview,
         sender_id, subject_text, body_text, channel, status, error_message, sent_at)
       VALUES ($1, 'student', $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        job.processId,
        job.total,
        job.recipients.map((r) => r.email).join(', '),
        job.senderId,
        subjectText,
        bodyText,
        job.channel,
        status,
        job.errors.length ? job.errors.join('; ') : null,
      ]
    )
  } catch (logErr) {
    console.error('[emailQueue] Failed to insert communication_log:', logErr.message)
  }

  setTimeout(() => jobs.delete(job.id), 10 * 60 * 1000)
}
