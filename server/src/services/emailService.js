import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { getSetting } from './settingsService.js'

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

export const sendWelcomeEmail = async ({ to, studentName, matricNo }) => {
  const subject = await getSetting('template_welcome_subject', 'Welcome to GTS — You Have Been Activated')
  const body = await getSetting('template_welcome_body', 'Dear {{studentName}},\n\nCongratulations! Your student account has been activated.\n\nYour Matriculation Number is: {{matricNo}}\n\nPlease keep this number safe — you will need it for future reference.\n\nGod bless you,\nThe GTS Team')

  const text = renderTemplate(body, { studentName, matricNo })
  const html = text.replace(/\n/g, '<br/>').replace(/{{\w+}}/g, '').replace(/{{#\w+}}.*?{{\/\w+}}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendGraduationEmail = async ({ to, studentName }) => {
  const subject = await getSetting('template_graduation_subject', 'Congratulations on Your Graduation — GTS')
  const body = await getSetting('template_graduation_body', 'Dear {{studentName}},\n\nOn behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.\n\nMay God continue to guide and bless you in your ministry.\n\nWith blessings,\nThe GTS Team')

  const text = renderTemplate(body, { studentName })
  const html = text.replace(/\n/g, '<br/>').replace(/{{\w+}}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendResultEmail = async ({ to, studentName, courseTitle, resultType, status, score }) => {
  const subjectTpl = await getSetting('template_result_subject', 'Your {{resultType}} Result — {{courseTitle}}')
  const bodyTpl = await getSetting('template_result_body', 'Dear {{studentName}},\n\nYour {{resultType}} result for "{{courseTitle}}" is now available.\n\nResult: {{status}}{{#score}} (Score: {{score}}/100){{/score}}\n\nGod bless you,\nThe GTS Team')

  const variables = { studentName, courseTitle, resultType, status, score: score != null ? score : '' }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/{{\w+}}/g, '').replace(/{{#\w+}}.*?{{\/\w+}}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}

export const sendAssignmentEmail = async ({ to, studentName, courseTitle, assignmentTitle, dueDate }) => {
  const subjectTpl = await getSetting('template_assignment_subject', 'New Assignment: {{assignmentTitle}}')
  const bodyTpl = await getSetting('template_assignment_body', 'Hello {{studentName}},\n\nYou have a new assignment in {{courseTitle}}: {{assignmentTitle}}.\nDue date: {{dueDate}}\n\nGTS')

  const variables = { studentName, courseTitle, assignmentTitle, dueDate: dueDate || 'N/A' }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/{{\w+}}/g, '')

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
  const subjectTpl = await getSetting('template_material_subject', 'New Course Material: {{materialTitle}}')
  const bodyTpl = await getSetting('template_material_body', 'Hello {{studentName}},\n\nA new material has been shared for {{courseTitle}}.\nTitle: {{materialTitle}}\nScope: {{sectionText}}\n{{#materialDescription}}Description: {{materialDescription}}{{/materialDescription}}\nLink: {{materialUrl}}\n\nGTS')

  const sectionText = sectionNumber ? `Section ${sectionNumber}` : 'General material'
  const variables = { studentName, courseTitle, materialTitle, sectionText, materialDescription: materialDescription || '', materialUrl }
  const subject = renderTemplate(subjectTpl, variables)
  const text = renderTemplate(bodyTpl, variables)
  const html = text.replace(/\n/g, '<br/>').replace(/{{\w+}}/g, '').replace(/{{#\w+}}.*?{{\/\w+}}/g, '')

  return send({
    to,
    subject,
    text,
    html: `<p>${html}</p>`,
  })
}
