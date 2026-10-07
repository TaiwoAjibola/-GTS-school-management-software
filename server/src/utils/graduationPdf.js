import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts')

const fontCache = {}
const loadFont = (file) => (fontCache[file] ||= readFileSync(join(FONTS_DIR, file)))

const registerFonts = (doc) => {
  doc.registerFont('Outfit', loadFont('Outfit-400.ttf'))
  doc.registerFont('OutfitSemi', loadFont('Outfit-600.ttf'))
  doc.registerFont('OutfitXB', loadFont('Outfit-800.ttf'))
  doc.registerFont('Inter', loadFont('Inter-400.ttf'))
  doc.registerFont('InterSemi', loadFont('Inter-600.ttf'))
  doc.registerFont('Mono', loadFont('JetBrainsMono-500.ttf'))
}

const MARGIN = 48

const C = {
  indigo: '#4F46E5',
  indigoSoft: '#EEF2FF',
  ink: '#0F172A',
  body: '#1E293B',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  zebra: '#F8FAFC',
  white: '#FFFFFF',
  passBg: '#D1FAE5',
  passFg: '#047857',
  failBg: '#FEE2E2',
  failFg: '#B91C1C',
  progBg: '#FEF3C7',
  progFg: '#B45309',
}

const STATUS_COLORS = {
  Graduated: { bg: C.passBg, fg: C.passFg },
  Graduating: { bg: C.indigoSoft, fg: '#4338CA' },
  Active: { bg: '#E0F2FE', fg: '#0369A1' },
  Alumni: { bg: '#F1F5F9', fg: '#475569' },
  'On Hold': { bg: C.progBg, fg: C.progFg },
  'On hold': { bg: C.progBg, fg: C.progFg },
}

const RESULT_COLORS = {
  Pass: { bg: C.passBg, fg: C.passFg },
  Fail: { bg: C.failBg, fg: C.failFg },
  'In Progress': { bg: C.progBg, fg: C.progFg },
}

const progressColor = (pct) => {
  if (pct >= 80) return C.passFg
  if (pct >= 50) return C.progFg
  return C.muted
}

const cellText = (v) => (v == null ? '' : String(v))

const fitToWidth = (doc, text, width) => {
  if (doc.widthOfString(text) <= width) return text
  let t = text
  while (t.length > 0 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1)
  return t ? `${t}…` : '…'
}

// Draws a rounded pill; returns its width.
const drawPill = (doc, text, x, y, { bg, fg, font = 'InterSemi', size = 8, padX = 8, h = 16 } = {}) => {
  doc.font(font).fontSize(size)
  const w = doc.widthOfString(text) + padX * 2
  doc.save().fillColor(bg).roundedRect(x, y, w, h, h / 2).fill().restore()
  doc.fillColor(fg).font(font).fontSize(size).text(text, x + padX, y + h / 2 - size * 0.62, { lineBreak: false })
  return w
}

const drawSectionHeading = (doc, label, y) => {
  const left = MARGIN
  doc.font('OutfitSemi').fontSize(13).fillColor(C.ink)
  doc.text(label, left, y, { lineBreak: false })
  const after = y + 17
  doc.save().fillColor(C.indigo).rect(left, after, 26, 3).fill().restore()
  return after + 11
}

/**
 * Generic table.
 * columns: [{ key, label, weight, align, mono, pill?(value,row), color?(value,row) }]
 * rows: plain objects. rowH/fontSize chosen by caller to fit the page.
 */
const drawTable = (doc, { columns, rows, startY, rowH = 16, fontSize = 8.5, headerH = 18 }) => {
  const left = MARGIN
  const contentW = doc.page.width - MARGIN * 2
  const contentBottom = doc.page.height - MARGIN - 6
  const totalWeight = columns.reduce((s, c) => s + (c.weight || 1), 0) || 1
  const widths = columns.map((c) => ((c.weight || 1) / totalWeight) * contentW)
  const xs = []
  let x = left
  for (const w of widths) {
    xs.push(x)
    x += w
  }
  const pad = 6

  let y = startY
  const tw = (i) => Math.max(widths[i] - pad * 2, 4)

  const drawHeader = () => {
    doc.save().fillColor(C.indigo).rect(left, y, contentW, headerH).fill().restore()
    columns.forEach((col, i) => {
      doc.font('InterSemi').fontSize(7.5).fillColor(C.white)
      doc.text(
        fitToWidth(doc, col.label.toUpperCase(), tw(i)),
        xs[i] + pad,
        y + headerH / 2 - 3.4,
        { width: tw(i), align: col.align || 'left', lineBreak: false }
      )
    })
    y += headerH
  }

  if (y + headerH + rowH > contentBottom) {
    doc.addPage()
    y = MARGIN + 6
  }
  drawHeader()

  rows.forEach((row, index) => {
    if (y + rowH > contentBottom) {
      doc.addPage()
      y = MARGIN + 6
      drawHeader()
    }

    if (index % 2 === 1) {
      doc.save().fillColor(C.zebra).rect(left, y, contentW, rowH).fill().restore()
    }

    columns.forEach((col, i) => {
      const value = row[col.key]
      const cellY = y + rowH / 2 - fontSize * 0.62
      const pillColors = col.pill ? col.pill(value, row) : null

      if (pillColors) {
        const text = cellText(value)
        doc.font('InterSemi').fontSize(fontSize)
        const pw = doc.widthOfString(text) + 12
        const px = col.align === 'center' ? xs[i] + (widths[i] - pw) / 2 : xs[i] + pad
        const ph = Math.min(rowH - 3, 14)
        doc.save()
          .fillColor(pillColors.bg)
          .roundedRect(px, y + (rowH - ph) / 2, pw, ph, ph / 2)
          .fill()
          .restore()
        doc.fillColor(pillColors.fg).font('InterSemi').fontSize(Math.min(fontSize, 7.5))
        doc.text(text, px + 6, y + rowH / 2 - Math.min(fontSize, 7.5) * 0.62, { lineBreak: false })
        doc.font('Inter').fontSize(fontSize)
        return
      }

      const font = col.mono ? 'Mono' : 'Inter'
      const color = col.color ? col.color(value, row) : C.body
      doc.font(font).fontSize(fontSize).fillColor(color)
      const str = fitToWidth(doc, cellText(value), tw(i))
      doc.text(str, xs[i] + pad, cellY, {
        width: tw(i),
        align: col.align || 'left',
        lineBreak: false,
      })
    })

    doc
      .moveTo(left, y + rowH)
      .lineTo(left + contentW, y + rowH)
      .lineWidth(0.5)
      .strokeColor(C.border)
      .stroke()

    y += rowH
  })

  return y
}

const drawStatCards = (doc, cards, y, { align = 'center', cardW: fixedW, cardH = 46 } = {}) => {
  if (!cards.length) return y
  const left = MARGIN
  const contentW = doc.page.width - MARGIN * 2
  const gap = 10
  const cardW = fixedW || Math.min(150, (contentW - gap * (cards.length - 1)) / cards.length)
  const totalW = cardW * cards.length + gap * (cards.length - 1)
  let x = align === 'center' ? left + (contentW - totalW) / 2 : left

  for (const card of cards) {
    doc.save()
      .lineWidth(1)
      .strokeColor(C.border)
      .fillColor(C.white)
      .roundedRect(x, y, cardW, cardH, 8)
      .fillAndStroke()
      .restore()
    doc.font('InterSemi').fontSize(7).fillColor(C.muted)
    doc.text(cellText(card.label).toUpperCase(), x, y + 10, {
      width: cardW,
      align: 'center',
      characterSpacing: 0.8,
      lineBreak: false,
    })
    doc.font('OutfitXB').fontSize(card.valueSize || 17).fillColor(card.color || C.indigo)
    doc.text(cellText(card.value), x, y + 23, { width: cardW, align: 'center', lineBreak: false })
    x += cardW + gap
  }
  return y + cardH
}

const takenRowsFor = (student, courses) => {
  const results = student.results || student.courses || {}
  return courses
    .map((course) => {
      const info = results[course.id]
      if (!info || (!info.result_status && info.enrollment_status !== 'active')) return null
      return {
        code: course.course_code || '',
        title: course.title || '',
        result: info.result_status || (info.enrollment_status === 'active' ? 'In Progress' : '—'),
        score: info.score ?? '—',
      }
    })
    .filter(Boolean)
}

const drawStudentPage = (doc, student, { courses, eyebrow }) => {
  const left = MARGIN
  const contentW = doc.page.width - MARGIN * 2
  const results = student.results || student.courses || {}
  let y = MARGIN + 8

  // Name (left) + status pill (right)
  doc.font('OutfitXB').fontSize(22).fillColor(C.ink)
  doc.text(student.full_name || 'Unnamed Student', left, y, { width: contentW - 110 })
  const status = student.status || ''
  const stColors = STATUS_COLORS[status] || { bg: C.indigoSoft, fg: C.indigo }
  if (status) {
    doc.font('InterSemi').fontSize(8)
    const pw = doc.widthOfString(status) + 16
    drawPill(doc, status, left + contentW - pw, y + 4, { ...stColors, size: 8 })
  }
  y += 30

  // Meta row: matric pill · batch · email
  let x = left
  if (student.matric_no) {
    x += drawPill(doc, student.matric_no, x, y, {
      bg: C.indigoSoft,
      fg: C.indigo,
      font: 'Mono',
      size: 8.5,
    }) + 10
  }
  doc.font('Inter').fontSize(9).fillColor(C.muted)
  if (student.cohort_name) {
    const batchLabel = /^batch\b/i.test(student.cohort_name) ? student.cohort_name : `Batch: ${student.cohort_name}`
    doc.text(batchLabel, x, y + 3, { lineBreak: false })
    x += doc.widthOfString(batchLabel) + 12
  }
  if (student.email) doc.text(student.email, x, y + 3, { lineBreak: false })
  y += 26

  // Divider
  doc.moveTo(left, y).lineTo(left + contentW, y).lineWidth(0.75).strokeColor(C.border).stroke()
  y += 16

  // Stat cards (left-aligned)
  const pct = student.completion_pct ?? 0
  y = drawStatCards(
    doc,
    [
      { label: 'Courses Passed', value: `${student.passed ?? 0} of ${student.total ?? 0}` },
      { label: 'Failed', value: student.failed ?? 0, color: (student.failed ?? 0) > 0 ? C.failFg : C.indigo },
      { label: 'Progress', value: `${pct}%`, color: progressColor(pct) },
    ],
    y,
    { align: 'left', cardW: 138, cardH: 44, valueSize: 15 }
  )
  y += 20

  y = drawSectionHeading(doc, 'Courses Taken', y)

  const rows = takenRowsFor(student, courses)
  if (!rows.length) {
    doc.font('Inter').fontSize(10).fillColor(C.faint)
    doc.text('No courses recorded for this student.', left, y, { lineBreak: false })
    return
  }

  drawTable(doc, {
    columns: [
      { key: 'code', label: 'Course Code', weight: 90, mono: true },
      { key: 'title', label: 'Course Title', weight: 240 },
      { key: 'result', label: 'Result', weight: 80, align: 'center', pill: (v) => RESULT_COLORS[v] || null },
      { key: 'score', label: 'Score', weight: 60, align: 'right', mono: true },
    ],
    rows,
    startY: y,
    rowH: 18,
    fontSize: 9,
    headerH: 20,
  })

  if (eyebrow) {
    // eyebrow reserved for future use
  }
}

const drawFooters = (doc, footerLabel) => {
  const range = doc.bufferedPageRange()
  const prevBottom = doc.page.margins.bottom
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.page.margins.bottom = 0
    const y = doc.page.height - 30
    doc.save()
      .moveTo(MARGIN, y - 9)
      .lineTo(doc.page.width - MARGIN, y - 9)
      .lineWidth(0.5)
      .strokeColor(C.border)
      .stroke()
      .restore()
    doc.font('Inter').fontSize(7.5).fillColor(C.muted)
    doc.text(footerLabel, MARGIN, y, { lineBreak: false })
    doc.text(`Page ${i + 1} of ${range.count}`, MARGIN, y, {
      width: doc.page.width - MARGIN * 2,
      align: 'right',
      lineBreak: false,
    })
    doc.page.margins.bottom = prevBottom
  }
}

/**
 * Graduation report PDF.
 * Page 1: summary (masthead, stat cards, graduates table — fits one page).
 * Pages 2..N+1: one page per student with their courses taken.
 *
 * students: [{ full_name, matric_no, email, cohort_name, status,
 *              passed, failed, total, completion_pct,
 *              results|courses: { [courseId]: { result_status, score, enrollment_status } } }]
 * courses:  [{ id, title, course_code }]
 * statCards: [{ label, value, color?, valueSize? }]
 */
export function drawGraduationPdf(
  res,
  {
    title,
    subtitleLines = [],
    statCards = [],
    students = [],
    courses = [],
    schoolName = '',
    filename = 'graduation-report.pdf',
  }
) {
  const school = (schoolName || '').trim() || 'Grace Theological Seminary'
  const doc = new PDFDocument({
    margin: MARGIN,
    size: 'A4',
    bufferPages: true,
    info: { Title: title, Author: 'Grace Theological Seminary' },
  })
  registerFonts(doc)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  doc.pipe(res)

  const left = MARGIN
  const contentW = doc.page.width - MARGIN * 2
  const contentBottom = doc.page.height - MARGIN - 6

  const accentBar = () => {
    doc.save().fillColor(C.indigo).rect(0, 0, doc.page.width, 6).fill().restore()
  }
  accentBar()
  doc.on('pageAdded', accentBar)

  // ── Page 1: Summary ────────────────────────────────────────────────
  let y = MARGIN + 10

  doc.font('InterSemi').fontSize(8.5).fillColor(C.indigo)
  doc.text(school.toUpperCase(), left, y, {
    width: contentW,
    align: 'center',
    characterSpacing: 2.4,
    lineBreak: false,
  })
  y += 20

  doc.font('OutfitXB').fontSize(26).fillColor(C.ink)
  doc.text(title, left, y, { width: contentW, align: 'center' })
  y = doc.y + 8

  doc.font('Inter').fontSize(9).fillColor(C.muted)
  for (const line of subtitleLines) {
    if (!line) continue
    doc.text(cellText(line), left, y, { width: contentW, align: 'center' })
    y = doc.y + 3
  }
  y += 12

  y = drawStatCards(doc, statCards, y, { align: 'center', cardH: 48 }) + 22

  y = drawSectionHeading(doc, 'Graduates', y)

  if (!students.length) {
    doc.font('Inter').fontSize(10).fillColor(C.faint)
    doc.text('No students match the current filters.', left, y, { lineBreak: false })
  } else {
    const n = students.length
    const headerH = 18
    const avail = contentBottom - y
    const rowH = Math.max(11, Math.min(16, Math.floor((avail - headerH) / n)))
    const fontSize = rowH >= 14 ? 8.5 : 7.5

    const rows = students.map((s, i) => ({
      sn: i + 1,
      matric: s.matric_no || '—',
      name: s.full_name || '',
      batch: s.cohort_name || '—',
      status: s.status || '—',
      passed: `${s.passed ?? 0} of ${s.total ?? 0}`,
      progress: `${s.completion_pct ?? 0}%`,
    }))

    drawTable(doc, {
      columns: [
        { key: 'sn', label: 'S/N', weight: 26, align: 'right' },
        { key: 'matric', label: 'Matric No', weight: 76, mono: true },
        { key: 'name', label: 'Full Name', weight: 140 },
        { key: 'batch', label: 'Batch', weight: 80 },
        { key: 'status', label: 'Status', weight: 68, pill: (v) => STATUS_COLORS[v] || null },
        { key: 'passed', label: 'Passed', weight: 56, align: 'center' },
        {
          key: 'progress',
          label: 'Progress',
          weight: 54,
          align: 'right',
          color: (v) => progressColor(parseInt(v, 10) || 0),
        },
      ],
      rows,
      startY: y,
      rowH,
      fontSize,
      headerH,
    })
  }

  // ── Pages 2..N+1: one page per student ─────────────────────────────
  for (const student of students) {
    doc.addPage()
    drawStudentPage(doc, student, { courses })
  }

  drawFooters(doc, `${school}  •  Graduation Report`)
  doc.end()
}
