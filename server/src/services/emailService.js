import dns from 'dns'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

dns.setDefaultResultOrder('ipv4first')

let transporter = null

const buildTransporter = () => {
  if (!env.smtpHost) throw new Error('SMTP host is not configured')
  if (!env.smtpUser) throw new Error('SMTP username is not configured')
  if (!env.smtpPass) throw new Error('SMTP password is not configured')

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
    family: 4,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  })
}

const getTransporter = () => {
  if (transporter) return transporter
  transporter = buildTransporter()
  return transporter
}

export const clearTransporterCache = () => {
  transporter = null
}

const getEmailFrom = () => {
  return env.emailFrom
}

const parseFrom = (from) => {
  // Handles "Name <email@domain>" or "email@domain"
  const m = from.match(/^(.*)<(.+)>$/)
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() }
  return { name: '', email: from.trim() }
}

const sendViaBrevoApi = async ({ to, subject, html }) => {
  if (!env.brevoApiKey) throw new Error('Brevo API key not configured')
  const from = parseFrom(getEmailFrom())
  const text = html ? html.replace(/<[^>]*>/g, '') : ''
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from.email, name: from.name || 'GTS Seminary' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${body}`)
  }
  return true
}

export const testSmtpConnection = async () => {
  // Prefer Brevo HTTP API (port 443, never blocked on Render) if key is set
  if (env.brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': env.brevoApiKey, 'accept': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `Brevo API ${res.status}: ${body}` }
      }
      return { ok: true, via: 'brevo-api' }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }
  const tx = getTransporter()
  return new Promise((resolve) => {
    tx.verify((err) => {
      if (err) resolve({ ok: false, error: err.message })
      else resolve({ ok: true, via: 'smtp' })
    })
  })
}

const renderTemplate = (template, variables) => {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(pattern, value != null ? value : '')
    const conditionalPattern = new RegExp(`\\{\\{#\\s*${key}\\s*\\}\\}([\\s\\S]*?)\\{\\{/\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(conditionalPattern, value ? '$1' : '')
  }
  return result
}

// ── Direct send (for admin-created templates) ──────────────────────
export const sendRawEmail = async ({ to, subject, html }) => {
  // Prefer Brevo API if configured (bypasses SMTP blocks on Render free)
  if (env.brevoApiKey) {
    try {
      return await sendViaBrevoApi({ to, subject, html })
    } catch (err) {
      // fall through to SMTP as fallback, but surface API error if SMTP also fails
      if (!env.smtpHost) throw err
    }
  }
  try {
    const tx = getTransporter()
    const from = getEmailFrom()
    const text = html ? html.replace(/<[^>]*>/g, '') : ''
    await tx.sendMail({ from, to, subject, text, html })
    return true
  } catch (err) {
    clearTransporterCache()
    throw err
  }
}

// ── Legacy email functions ─────────────────────────────────────────
const send = async (mailOptions) => {
  if (env.brevoApiKey) {
    return sendViaBrevoApi({ to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html })
  }
  const tx = await getTransporter()
  const from = getEmailFrom()
  await tx.sendMail({ from, ...mailOptions })
  return true
}

export const clearProcessCache = () => {}

export const sendProcessEmail = async (processKey, variables, recipientEmail, attachments = []) => {
  try {
    const html = '<p>Legacy email process no longer supported.</p>'
    return send({ to: recipientEmail, subject: processKey, html, attachments })
  } catch { return false }
}

export const sendWelcomeEmail = async ({ to, studentName, matricNo }) => {
  return sendRawEmail({ to, subject: 'Welcome to GTS', html: `<p>Dear ${studentName}, your account has been activated. Matric: ${matricNo}</p>` })
}

export const sendGraduationEmail = async ({ to, studentName }) => {
  return sendRawEmail({ to, subject: 'Congratulations on Your Graduation', html: `<p>Dear ${studentName}, congratulations!</p>` })
}

export const sendResultEmail = async ({ to, studentName, courseTitle, resultType, status, score }) => {
  return sendRawEmail({ to, subject: `Your ${resultType} Result`, html: `<p>Dear ${studentName}, your result for ${courseTitle}: ${status}</p>` })
}

export const sendAssignmentEmail = async ({ to, studentName, courseTitle, assignmentTitle, dueDate }) => {
  return sendRawEmail({ to, subject: `New Assignment: ${assignmentTitle}`, html: `<p>Dear ${studentName}, new assignment in ${courseTitle}: ${assignmentTitle}. Due: ${dueDate}</p>` })
}

export const sendExamEmail = async ({ to, studentName, courseTitle, examTitle, dueDate, questions, examType, quizUrl, accessCode }) => {
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const dueLine = dueDate ? `<p style="margin:6px 0 0;color:#64748b">Please complete this by <strong>${escapeHtml(dueDate)}</strong>.</p>` : ''

  const isMcq = examType === 'mcq'

  let bodyHtml
  if (isMcq) {
    const link = escapeHtml(quizUrl || '')
    const code = escapeHtml(accessCode || '')
    const codeBox = code
      ? `<div style="margin:16px 0;padding:14px 18px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px">
           <p style="margin:0;font-size:12px;color:#0e7490;font-weight:bold">YOUR ACCESS ID</p>
           <p style="margin:4px 0 0;font-size:24px;letter-spacing:3px;font-weight:bold;color:#155e75">${code}</p>
         </div>`
      : ''
    bodyHtml = `
      <p style="color:#334155;margin:0 0 16px">Your online MCQ exam is ready. Open the quiz link below and enter your Access ID to unlock the questions. Submit once — your score is stored and will be emailed when the lecturer releases results.</p>
      <a href="${link}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Open Quiz</a>
      ${codeBox}
      ${dueLine}`
  } else {
    const questionList = (questions || [])
      .map(
        (q, index) =>
          `<li style="margin-bottom:14px;line-height:1.6">
             <strong>Q${index + 1}.</strong> ${escapeHtml(q.question_text)}
           </li>`
      )
      .join('')
    bodyHtml = `
      <p style="color:#334155;margin:0 0 16px">Your exam paper is listed below. Answer each question and submit your responses.</p>
      <ol style="color:#0f172a;padding-left:20px;margin:0 0 16px">${questionList}</ol>
      ${dueLine}`
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#0f172a;margin:0 0 4px">${escapeHtml(examTitle)}</h2>
      <p style="color:#475569;margin:0 0 16px">${escapeHtml(courseTitle || '')}</p>
      <p style="color:#0f172a;margin:0 0 16px">Dear ${escapeHtml(studentName)},</p>
      ${bodyHtml}
      <p style="color:#475569;margin:16px 0 0;font-size:12px">Grace Theological Seminary (GTS)</p>
    </div>`

  return sendRawEmail({ to, subject: `Exam Paper: ${examTitle}`, html })
}

export const sendMcqResultEmail = async ({ to, studentName, courseTitle, examTitle, score, correctCount, totalQuestions }) => {
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
      <h2 style="color:#0f172a;margin:0 0 4px">${escapeHtml(examTitle)} — Result</h2>
      <p style="color:#475569;margin:0 0 16px">${escapeHtml(courseTitle || '')}</p>
      <p style="color:#0f172a;margin:0 0 16px">Dear ${escapeHtml(studentName)},</p>
      <p style="color:#334155;margin:0 0 16px">Your MCQ exam result is now available.</p>
      <div style="margin:16px 0;padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:center">
        <p style="margin:0;font-size:12px;color:#166534;font-weight:bold;letter-spacing:1px">SCORE</p>
        <p style="margin:6px 0 0;font-size:36px;font-weight:bold;color:#14532d">${escapeHtml(score)}%</p>
        <p style="margin:8px 0 0;font-size:14px;color:#166534">${escapeHtml(correctCount)} of ${escapeHtml(totalQuestions)} correct</p>
      </div>
      <p style="color:#475569;margin:16px 0 0;font-size:12px">Grace Theological Seminary (GTS)</p>
    </div>`

  return sendRawEmail({ to, subject: `MCQ Result: ${examTitle}`, html })
}

export const sendCourseMaterialEmail = async ({ to, studentName, courseTitle, materialTitle, materialDescription, sectionNumber, materialUrl }) => {
  return sendRawEmail({ to, subject: `New Material: ${materialTitle}`, html: `<p>Dear ${studentName}, new material for ${courseTitle}: ${materialTitle}</p>` })
}

export const sendApplicationReceivedEmail = async ({ to, studentName }) => {
  return sendRawEmail({ to, subject: 'Application Received', html: `<p>Dear ${studentName}, your application has been received.</p>` })
}

export const sendApplicationAcceptedEmail = async ({ to, studentName }) => {
  return sendRawEmail({ to, subject: 'Application Accepted', html: `<p>Dear ${studentName}, your application has been accepted.</p>` })
}

export const sendStudentSuspendedEmail = async ({ to, studentName, reason }) => {
  return sendRawEmail({ to, subject: 'Account Suspended', html: `<p>Dear ${studentName}, your account has been suspended. Reason: ${reason}</p>` })
}

export const sendStudentOnHoldEmail = async ({ to, studentName, reason }) => {
  return sendRawEmail({ to, subject: 'Account On Hold', html: `<p>Dear ${studentName}, your account is on hold. Reason: ${reason}</p>` })
}
