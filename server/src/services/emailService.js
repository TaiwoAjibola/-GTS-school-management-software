import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { getSetting } from './settingsService.js'
import { query } from '../db/pool.js'

let transporter = null

const getTransporter = async () => {
  const emailEnabled = await getSetting('email_enabled', 'true')
  if (emailEnabled !== 'true') return null

  const smtpHost = await getSetting('smtp_host', env.smtpHost)
  const smtpPort = Number(await getSetting('smtp_port', String(env.smtpPort)))
  const smtpUser = await getSetting('smtp_user', env.smtpUser)
  const smtpPass = await getSetting('smtp_pass', env.smtpPass)

  if (!smtpHost || !smtpUser || !smtpPass) return null

  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  return transporter
}

const getEmailFrom = async () => {
  return await getSetting('email_from', env.emailFrom)
}

const renderTemplate = (template, variables) => {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(pattern, value != null ? value : '')
    const conditionalPattern = new RegExp(`\\{\\{#\\s*${key}\\s*\\}\\}([\\s\\S]*?)\\{\\{/\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(conditionalPattern, value ? `$1` : '')
  }
  return result
}

const send = async (mailOptions) => {
  const tx = await getTransporter()
  if (!tx) return false
  const from = await getEmailFrom()
  await tx.sendMail({ from, ...mailOptions })
  return true
}

// ── Process-based email sending ────────────────────────────────────
// This is the new primary method for sending emails.
// It looks up the template from the email_processes table.

let processCache = null
let processCacheExpiry = 0
const PROCESS_CACHE_TTL = 60 * 1000

const loadProcesses = async () => {
  const now = Date.now()
  if (processCache && now < processCacheExpiry) return processCache

  try {
    const result = await query('SELECT * FROM email_processes')
    const map = {}
    for (const row of result.rows) {
      map[row.process_key] = row
    }
    processCache = map
    processCacheExpiry = now + PROCESS_CACHE_TTL
    return map
  } catch {
    return processCache || {}
  }
}

export const clearProcessCache = () => {
  processCache = null
  processCacheExpiry = 0
}

/**
 * Send an email using the process-based template system.
 * Falls back to legacy settings-based templates if the process table doesn't exist yet.
 * @param {string} processKey The key for the email process (e.g. 'student_activated')
 * @param {object} variables Template variables
 * @param {string} recipientEmail Recipient's email address
 * @param {Array} attachments Optional array of nodemailer attachments
 */
export const sendProcessEmail = async (processKey, variables, recipientEmail, attachments = []) => {
  try {
    const processes = await loadProcesses()
    const process = processes[processKey]

    if (!process) {
      console.warn(`⚠️  Email process "${processKey}" not found in database`)
      return false
    }

    if (!process.enabled) {
      console.log(`ℹ️  Email process "${processKey}" is disabled, skipping`)
      return false
    }

    const subject = renderTemplate(process.subject_template, variables)
    const text = renderTemplate(process.body_template, variables)
    const html = text
      .replace(/\n/g, '<br/>')
      .replace(/\{\{\w+\}\}/g, '')
      .replace(/\{\{#\w+\}\}.*?\{\{\/\w+\}\}/g, '')

    return send({
      to: recipientEmail,
      subject,
      text,
      html: `<p>${html}</p>`,
      attachments,
    })
  } catch (error) {
    console.error(`❌ sendProcessEmail(${processKey}) failed:`, error.message)
    return false
  }
}

// ── Legacy email functions ─────────────────────────────────────────
// These now delegate to the process-based system where possible,
// with fallback to the old settings-based approach.

export const sendWelcomeEmail = async ({ to, studentName, matricNo }) => {
  // Try process-based first
  const sent = await sendProcessEmail('student_activated', { studentName, matricNo, email: to }, to)
  if (sent) return true

  // Fallback to legacy
  const subject = await getSetting('template_welcome_subject', 'Welcome to GTS — You Have Been Activated')
  const body = await getSetting('template_welcome_body', 'Dear {{studentName}},\n\nCongratulations! Your student account has been activated.\n\nYour Matriculation Number is: {{matricNo}}\n\nPlease keep this number safe — you will need it for future reference.\n\nGod bless you,\nThe GTS Team')

  const text = renderTemplate(body, { studentName, matricNo })
  const html = text.replace(/\n/g, '<br/>').replace(/\{\{\w+\}\}/g, '').replace(/\{\{#\w+\}\}.*?\{\{\/\w+\}\}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendGraduationEmail = async ({ to, studentName }) => {
  const sent = await sendProcessEmail('graduation', { studentName }, to)
  if (sent) return true

  const subject = await getSetting('template_graduation_subject', 'Congratulations on Your Graduation — GTS')
  const body = await getSetting('template_graduation_body', 'Dear {{studentName}},\n\nOn behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.\n\nMay God continue to guide and bless you in your ministry.\n\nWith blessings,\nThe GTS Team')

  const text = renderTemplate(body, { studentName })
  const html = text.replace(/\n/g, '<br/>').replace(/\{\{\w+\}\}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendResultEmail = async ({ to, studentName, courseTitle, resultType, status, score }) => {
  const sent = await sendProcessEmail('result_published', { studentName, courseTitle, resultType, status, score: score != null ? score : '' }, to)
  if (sent) return true

  const subjectTpl = await getSetting('template_result_subject', 'Your {{resultType}} Result — {{courseTitle}}')
  const bodyTpl = await getSetting('template_result_body', 'Dear {{studentName}},\n\nYour {{resultType}} result for "{{courseTitle}}" is now available.\n\nResult: {{status}}{{#score}} (Score: {{score}}/100){{/score}}\n\nGod bless you,\nThe GTS Team')

  const variables = { studentName, courseTitle, resultType, status, score: score != null ? score : '' }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/\{\{\w+\}\}/g, '').replace(/\{\{#\w+\}\}.*?\{\{\/\w+\}\}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendAssignmentEmail = async ({ to, studentName, courseTitle, assignmentTitle, dueDate }) => {
  const sent = await sendProcessEmail('assignment_released', { studentName, courseTitle, assignmentTitle, dueDate: dueDate || 'N/A' }, to)
  if (sent) return true

  const subjectTpl = await getSetting('template_assignment_subject', 'New Assignment: {{assignmentTitle}}')
  const bodyTpl = await getSetting('template_assignment_body', 'Hello {{studentName}},\n\nYou have a new assignment in {{courseTitle}}: {{assignmentTitle}}.\nDue date: {{dueDate}}\n\nGTS')

  const variables = { studentName, courseTitle, assignmentTitle, dueDate: dueDate || 'N/A' }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/\{\{\w+\}\}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendCourseMaterialEmail = async ({
  to,
  studentName,
  courseTitle,
  materialTitle,
  materialDescription,
  sectionNumber,
  materialUrl,
}) => {
  const sectionText = sectionNumber ? `Section ${sectionNumber}` : 'General material'
  const sent = await sendProcessEmail('course_material_shared', { studentName, courseTitle, materialTitle, sectionText, materialDescription: materialDescription || '', materialUrl }, to)
  if (sent) return true

  const subjectTpl = await getSetting('template_material_subject', 'New Course Material: {{materialTitle}}')
  const bodyTpl = await getSetting('template_material_body', 'Hello {{studentName}},\n\nA new material has been shared for {{courseTitle}}.\nTitle: {{materialTitle}}\nScope: {{sectionText}}\n{{#materialDescription}}Description: {{materialDescription}}{{/materialDescription}}\nLink: {{materialUrl}}\n\nGTS')

  const variables = { studentName, courseTitle, materialTitle, sectionText, materialDescription: materialDescription || '', materialUrl }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/\{\{\w+\}\}/g, '').replace(/\{\{#\w+\}\}.*?\{\{\/\w+\}\}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

// ── New lifecycle emails ───────────────────────────────────────────

export const sendApplicationReceivedEmail = async ({ to, studentName }) => {
  return sendProcessEmail('application_received', { studentName, email: to }, to)
}

export const sendApplicationAcceptedEmail = async ({ to, studentName }) => {
  return sendProcessEmail('application_accepted', { studentName, email: to }, to)
}

export const sendStudentSuspendedEmail = async ({ to, studentName, reason }) => {
  return sendProcessEmail('student_suspended', { studentName, reason: reason || '' }, to)
}

export const sendStudentOnHoldEmail = async ({ to, studentName, reason }) => {
  return sendProcessEmail('student_on_hold', { studentName, reason: reason || '' }, to)
}
