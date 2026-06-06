import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
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
  const tx = getTransporter()
  const from = getEmailFrom()
  const text = html ? html.replace(/<[^>]*>/g, '') : ''
  await tx.sendMail({ from, to, subject, text, html })
  return true
}

// ── Legacy email functions ─────────────────────────────────────────
const send = async (mailOptions) => {
  const tx = getTransporter()
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
