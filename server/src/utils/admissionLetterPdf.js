import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts')

const fontCache = {}
const loadFont = (file) => (fontCache[file] ||= readFileSync(join(FONTS_DIR, file)))

const registerFonts = (doc) => {
  try {
    doc.registerFont('Outfit', loadFont('Outfit-400.ttf'))
    doc.registerFont('OutfitSemi', loadFont('Outfit-600.ttf'))
    doc.registerFont('OutfitXB', loadFont('Outfit-800.ttf'))
    doc.registerFont('Inter', loadFont('Inter-400.ttf'))
    doc.registerFont('InterSemi', loadFont('Inter-600.ttf'))
    doc.registerFont('Mono', loadFont('JetBrainsMono-500.ttf'))
  } catch {
    // Fallback to built-in fonts if custom fonts unavailable
  }
}

const safe = (v, fallback = '') => (v == null || v === '' ? fallback : String(v))

/**
 * Generate a dynamic admission letter PDF (Buffer) modelled after the GTS admission letter.
 *
 * data: {
 *   studentName, admissionNo, admissionDate, effectiveDate, academicSession,
 *   programmeName, degreeAward,
 *   schoolName, schoolTagline, schoolAddress, schoolEmail, schoolPhone, schoolMotto,
 *   salutation
 * }
 */
export const generateAdmissionLetterPdf = (data = {}) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Admission Letter', Author: 'Grace & Truth Theological Seminary' } })
  registerFonts(doc)

  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  doc.on('end', () => resolve(Buffer.concat(chunks)))
  doc.on('error', reject)

  const pageW = doc.page.width
  const left = doc.page.margins.left
  const right = pageW - doc.page.margins.right
  const contentW = right - left

  const studentName = safe(data.studentName, 'Student')
  const admissionNo = safe(data.admissionNo, '')
  const admissionDate = safe(data.admissionDate, '')
  const effectiveDate = safe(data.effectiveDate, admissionDate)
  const academicSession = safe(data.academicSession, '')
  const programmeName = safe(data.programmeName, 'Associate Degree Programme')
  const degreeAward = safe(data.degreeAward, 'Associate of Arts (AA) in Theology')
  const schoolName = safe(data.schoolName, 'Grace & Truth Theological Seminary')
  const schoolTagline = safe(data.schoolTagline, 'A 1689 Confessional Baptist Seminary')
  const schoolAddress = safe(data.schoolAddress, '451A, Oluwadamilola Fashade, Omole Estate, Ojodu, Lagos.')
  const schoolEmail = safe(data.schoolEmail, 'info@gtslagos.ng')
  const schoolPhone = safe(data.schoolPhone, '+234-803-2622-079')
  const schoolMotto = safe(data.schoolMotto, 'For CHRIST and His Church')
  const salutation = safe(data.salutation, 'Dear Sir,')

  const fontBody = (doc._registeredFonts && doc._registeredFonts.Inter) ? 'Inter' : 'Helvetica'
  const fontSemi = (doc._registeredFonts && doc._registeredFonts.InterSemi) ? 'InterSemi' : 'Helvetica-Bold'
  const fontTitle = (doc._registeredFonts && doc._registeredFonts.OutfitXB) ? 'OutfitXB' : 'Helvetica-Bold'
  const fontHead = (doc._registeredFonts && doc._registeredFonts.OutfitSemi) ? 'OutfitSemi' : 'Helvetica-Bold'

  let y = 40

  // Header: left address, right/branding block
  const headerTop = y
  doc.font(fontBody).fontSize(9).fillColor('#334155')
  const addressLines = schoolAddress.split(/\n|,(?=\s*[A-Z])/).map((s) => s.trim()).filter(Boolean)
  const addrX = left
  let addrY = headerTop
  for (const line of addressLines) {
    doc.text(line, addrX, addrY, { width: 220, align: 'left' })
    addrY = doc.y
  }

  // Branding (right side)
  const brandX = left + 250
  const brandW = contentW - 250
  doc.font(fontBody).fontSize(8.5).fillColor('#475569')
  doc.text(schoolTagline, brandX, headerTop, { width: brandW, align: 'right' })
  doc.moveDown(0.2)
  doc.font(fontTitle).fontSize(16).fillColor('#0f172a')
  doc.text('Grace & Truth', brandX, doc.y, { width: brandW, align: 'right' })
  doc.font(fontTitle).fontSize(13).fillColor('#0f172a')
  doc.text('Theological Seminary', brandX, doc.y, { width: brandW, align: 'right' })
  doc.moveDown(0.15)
  doc.font(fontBody).fontSize(8.5).fillColor('#334155')
  doc.text(`${schoolEmail}`, brandX, doc.y, { width: brandW, align: 'right' })
  doc.text(`${schoolPhone}`, brandX, doc.y, { width: brandW, align: 'right' })

  y = Math.max(addrY, doc.y) + 8
  doc.font(fontSemi).fontSize(9).fillColor('#4f46e5')
  doc.text(schoolMotto, left, y, { width: contentW, align: 'center' })
  y = doc.y + 18

  // Title
  doc.font(fontTitle).fontSize(18).fillColor('#0f172a')
  doc.text('Admission Letter', left, y, { width: contentW, align: 'center', underline: false })
  y = doc.y + 16

  // Student name, date, admission number
  doc.font(fontHead).fontSize(13).fillColor('#0f172a')
  doc.text(studentName, left, y, { width: contentW, align: 'left' })
  y = doc.y + 6
  if (admissionDate) {
    doc.font(fontBody).fontSize(10).fillColor('#334155')
    doc.text(admissionDate, left, y, { width: contentW, align: 'left' })
    y = doc.y + 4
  }
  if (admissionNo) {
    doc.font(fontSemi).fontSize(10).fillColor('#334155')
    doc.text(admissionNo, left, y, { width: contentW, align: 'left' })
    y = doc.y + 10
  }

  // Salutation
  doc.font(fontBody).fontSize(11).fillColor('#111827')
  doc.text(salutation, left, y)
  y = doc.y + 10

  // Offer heading
  doc.font(fontSemi).fontSize(11).fillColor('#0f172a')
  doc.text(`OFFER OF ADMISSION INTO ${programmeName.toUpperCase()}`, left, y, { width: contentW, align: 'center' })
  y = doc.y + 2
  if (academicSession) {
    doc.text(`${academicSession} ACADEMIC SESSION.`, left, y, { width: contentW, align: 'center' })
    y = doc.y + 10
  } else {
    y = doc.y + 8
  }

  // Body
  const bodyText = `Regarding your application for admission into the ${programmeName} in ${schoolName}. I am pleased to inform you that you have been offered admission to pursue an academic programme leading to the award of ${degreeAward}, with effect from ${effectiveDate || 'the stated commencement date'}.`
  doc.font(fontBody).fontSize(10.5).fillColor('#1f2937')
  doc.text(bodyText, left, y, { width: contentW, align: 'justify', lineGap: 3 })
  y = doc.y + 10

  doc.text('Please take note of the following conditions related to your admission:', left, y, { width: contentW, align: 'left' })
  y = doc.y + 6

  const conditions = [
    "That you commit to submitting to the seminary's rules.",
    'That you commit to attending all classes as stipulated in the time-table.',
    'That you commit to completing all assignments on time as at when due.',
    'That you commit to all practical ministry tasks assigned.',
    'That you behave respectfully to both colleagues and faculty.',
    'That you commit to complete the entire (chosen) course.',
  ]
  conditions.forEach((c, i) => {
    doc.text(`${i + 1}. ${c}`, left + 12, y, { width: contentW - 12, align: 'left', lineGap: 2 })
    y = doc.y + 2
  })
  y += 6

  doc.text('GTS has the right to terminate this admission at will, without contest or arbitration.', left, y, { width: contentW, align: 'justify', lineGap: 3 })
  y = doc.y + 8

  doc.text("My prayer is that you may not only grow in grace and the knowledge of our Saviour Jesus Christ, but that you may be a doer of God's word.", left, y, { width: contentW, align: 'justify', lineGap: 3 })
  y = doc.y + 8

  doc.text('Congratulations and welcome to GTS.', left, y, { width: contentW, align: 'left' })
  y = doc.y + 14

  doc.text('Yours in Christ', left, y)
  y = doc.y + 28

  // Signatures
  const sigY = Math.min(y, doc.page.height - 140)
  const col1 = left
  const col2 = left + contentW / 2
  doc.font(fontSemi).fontSize(10.5).fillColor('#0f172a')
  doc.text('Pastor Tony Okoroh', col1, sigY)
  doc.font(fontBody).fontSize(10).fillColor('#334155')
  doc.text('President', col1, doc.y)

  doc.font(fontSemi).fontSize(10.5).fillColor('#0f172a')
  doc.text('Joel Uzamere', col2, sigY)
  doc.font(fontBody).fontSize(10).fillColor('#334155')
  doc.text('Rector', col2, doc.y)

  doc.end()
})

export default generateAdmissionLetterPdf
