import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transporter = null

if (env.smtpHost && env.smtpUser && env.smtpPass) {
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  })
}

const send = async (mailOptions) => {
  if (!transporter) return false
  await transporter.sendMail({ from: env.emailFrom, ...mailOptions })
  return true
}

export const sendWelcomeEmail = async ({ to, studentName, matricNo }) => {
  return send({
    to,
    subject: 'Welcome to GTS — You Have Been Activated',
    text: `Dear ${studentName},\n\nCongratulations! Your student account has been activated.\n\nYour Matriculation Number is: ${matricNo}\n\nPlease keep this number safe — you will need it for future reference.\n\nGod bless you,\nThe GTS Team`,
    html: `<p>Dear <strong>${studentName}</strong>,</p>
<p>Congratulations! Your student account has been activated.</p>
<p>Your Matriculation Number is: <strong style="font-size:1.2em;">${matricNo}</strong></p>
<p>Please keep this number safe — you will need it for future reference.</p>
<br/><p>God bless you,<br/>The GTS Team</p>`,
  })
}

export const sendGraduationEmail = async ({ to, studentName }) => {
  return send({
    to,
    subject: 'Congratulations on Your Graduation — GTS',
    text: `Dear ${studentName},\n\nOn behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.\n\nMay God continue to guide and bless you in your ministry.\n\nWith blessings,\nThe GTS Team`,
    html: `<p>Dear <strong>${studentName}</strong>,</p>
<p>On behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.</p>
<p>May God continue to guide and bless you in your ministry.</p>
<br/><p>With blessings,<br/>The GTS Team</p>`,
  })
}

export const sendResultEmail = async ({ to, studentName, courseTitle, resultType, status, score }) => {
  const scoreText = score != null ? ` (Score: ${score}/100)` : ''
  const statusLine = status === 'Pass'
    ? `We are pleased to inform you that you have <strong>passed</strong> this ${resultType.toLowerCase()}${scoreText}.`
    : `We regret to inform you that you did not pass this ${resultType.toLowerCase()}${scoreText}. Please speak with your lecturer for further guidance.`

  return send({
    to,
    subject: `Your ${resultType} Result — ${courseTitle}`,
    text: `Dear ${studentName},\n\nYour ${resultType} result for "${courseTitle}" is now available.\n\nResult: ${status}${scoreText}\n\nGod bless you,\nThe GTS Team`,
    html: `<p>Dear <strong>${studentName}</strong>,</p>
<p>Your <strong>${resultType}</strong> result for "<em>${courseTitle}</em>" is now available.</p>
<p>${statusLine}</p>
<br/><p>God bless you,<br/>The GTS Team</p>`,
  })
}

export const sendAssignmentEmail = async ({ to, studentName, courseTitle, assignmentTitle, dueDate }) => {
  return send({
    to,
    subject: `New Assignment: ${assignmentTitle}`,
    text: `Hello ${studentName},\n\nYou have a new assignment in ${courseTitle}: ${assignmentTitle}.\nDue date: ${dueDate || 'N/A'}\n\nGTS`,
    html: `<p>Hello <strong>${studentName}</strong>,</p>
<p>You have a new assignment in <em>${courseTitle}</em>: <strong>${assignmentTitle}</strong>.</p>
<p>Due date: ${dueDate || 'N/A'}</p>
<br/><p>The GTS Team</p>`,
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

  return send({
    to,
    subject: `New Course Material: ${materialTitle}`,
    text: `Hello ${studentName},\n\nA new material has been shared for ${courseTitle}.\nTitle: ${materialTitle}\nScope: ${sectionText}\n${materialDescription ? `Description: ${materialDescription}\n` : ''}Link: ${materialUrl}\n\nGTS`,
    html: `<p>Hello <strong>${studentName}</strong>,</p>
<p>A new material has been shared for <em>${courseTitle}</em>.</p>
<p><strong>${materialTitle}</strong> (${sectionText})</p>
${materialDescription ? `<p>${materialDescription}</p>` : ''}
<p><a href="${materialUrl}">Open Material</a></p>
<br/><p>The GTS Team</p>`,
  })
}
