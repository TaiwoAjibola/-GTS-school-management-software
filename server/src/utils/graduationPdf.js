import PDFDocument from 'pdfkit'

const MARGIN = 40
const HEADER_FILL = '#4F46E5'
const HEADER_TEXT = '#FFFFFF'
const BODY_TEXT = '#1E293B'
const ZEBRA_FILL = '#F8FAFC'
const ROW_BORDER = '#E2E8F0'
const MASTHEAD_COLOR = '#64748B'
const TITLE_COLOR = '#0F172A'
const SUBTITLE_COLOR = '#475569'
const HEADER_ROW_HEIGHT = 20
const ROW_HEIGHT = 18
const CELL_PADDING = 4

const RESULT_COLORS = {
  Pass: '#059669',
  Fail: '#DC2626',
  'In Progress': '#D97706',
}

const TAKEN_COLUMNS = [
  { key: 'course_code', label: 'Course Code', width: 80 },
  { key: 'title', label: 'Course Title', width: 200 },
  { key: 'result', label: 'Result', width: 80 },
  { key: 'score', label: 'Score', width: 50, align: 'right' },
]

const cellText = (value) => (value == null ? '' : String(value))

const fitToWidth = (doc, text, width) => {
  if (doc.widthOfString(text) <= width) return text
  let trimmed = text
  while (trimmed.length > 0 && doc.widthOfString(`${trimmed}…`) > width) {
    trimmed = trimmed.slice(0, -1)
  }
  return trimmed ? `${trimmed}…` : '…'
}

export function drawTable(doc, { columns = [], rows = [], startY } = {}) {
  if (!columns.length) return startY ?? doc.y

  const left = doc.page.margins.left
  const right = doc.page.margins.right
  const contentWidth = doc.page.width - left - right
  const pageBottom = doc.page.height - doc.page.margins.bottom
  const totalWeight = columns.reduce((sum, col) => sum + (col.width || 1), 0) || 1
  const widths = columns.map((col) => ((col.width || 1) / totalWeight) * contentWidth)

  const xs = []
  let x = left
  for (const w of widths) {
    xs.push(x)
    x += w
  }

  let y = startY ?? doc.y
  const textWidth = (i) => Math.max(widths[i] - CELL_PADDING * 2, 4)

  const pageBreak = () => {
    doc.addPage()
    y = doc.page.margins.top
  }

  const drawHeader = () => {
    doc.fillColor(HEADER_FILL).rect(left, y, contentWidth, HEADER_ROW_HEIGHT).fill()
    doc.font('Helvetica-Bold').fontSize(9)
    columns.forEach((col, i) => {
      const str = fitToWidth(doc, cellText(col.label), textWidth(i))
      doc.fillColor(HEADER_TEXT).text(str, xs[i] + CELL_PADDING, y + 5, {
        width: textWidth(i),
        height: 12,
        ellipsis: true,
        align: col.align || 'left',
      })
    })
    y += HEADER_ROW_HEIGHT
    doc.fillColor(BODY_TEXT)
  }

  if (y + HEADER_ROW_HEIGHT + ROW_HEIGHT > pageBottom) pageBreak()
  drawHeader()

  rows.forEach((row, index) => {
    if (y + ROW_HEIGHT > pageBottom) {
      pageBreak()
      drawHeader()
    }

    if (index % 2 === 1) {
      doc.fillColor(ZEBRA_FILL).rect(left, y, contentWidth, ROW_HEIGHT).fill()
    }

    doc.font('Helvetica').fontSize(9)
    columns.forEach((col, i) => {
      const cell = row[i]
      const isObject = cell !== null && typeof cell === 'object'
      const raw = isObject ? cell.text : cell
      const color = (isObject && cell.color) || BODY_TEXT
      const str = fitToWidth(doc, cellText(raw), textWidth(i))
      doc.fillColor(color).text(str, xs[i] + CELL_PADDING, y + 4, {
        width: textWidth(i),
        height: 12,
        ellipsis: true,
        align: col.align || 'left',
      })
    })

    doc
      .moveTo(left, y + ROW_HEIGHT)
      .lineTo(left + contentWidth, y + ROW_HEIGHT)
      .lineWidth(0.5)
      .strokeColor(ROW_BORDER)
      .stroke()

    y += ROW_HEIGHT
  })

  doc.fillColor(BODY_TEXT)
  return y
}

const drawSectionHeading = (doc, label, y) => {
  const left = doc.page.margins.left
  const contentWidth = doc.page.width - left - doc.page.margins.right
  const pageBottom = doc.page.height - doc.page.margins.bottom

  if (y + 78 > pageBottom) {
    doc.addPage()
    y = doc.page.margins.top
  }

  doc.fillColor(TITLE_COLOR).font('Helvetica-Bold').fontSize(12)
  doc.text(label, left, y, { width: contentWidth })
  return doc.y + 8
}

const drawGroupHeading = (doc, group, y) => {
  const left = doc.page.margins.left
  const parts = []
  if (group.matricNo) parts.push(`  ${group.matricNo}`)
  if (group.batch) parts.push(`  — ${group.batch}`)

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TITLE_COLOR)
  if (parts.length) {
    doc.text(cellText(group.name), left, y, { continued: true })
    doc.font('Helvetica').fontSize(9).fillColor(MASTHEAD_COLOR)
    doc.text(parts.join(''))
  } else {
    doc.text(cellText(group.name), left, y)
  }

  return doc.y + 4
}

export function drawReportPdf(
  res,
  { title, subtitleLines = [], stats = [], graduatesRows = null, takenGroups = [], filename = 'graduation-report.pdf' }
) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', info: { Title: title } })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  doc.pipe(res)

  const left = doc.page.margins.left
  const contentWidth = doc.page.width - left - doc.page.margins.right
  const pageBottom = () => doc.page.height - doc.page.margins.bottom

  let y = doc.page.margins.top

  doc.fillColor(MASTHEAD_COLOR).font('Helvetica').fontSize(9)
  doc.text('GRACE THEOLOGICAL SEMINARY', left, y, {
    width: contentWidth,
    align: 'center',
    characterSpacing: 1.6,
  })
  y = doc.y + 8

  doc.fillColor(TITLE_COLOR).font('Helvetica-Bold').fontSize(20)
  doc.text(title, left, y, { width: contentWidth, align: 'center' })
  y = doc.y + 8

  doc.fillColor(MASTHEAD_COLOR).font('Helvetica').fontSize(10)
  for (const line of subtitleLines) {
    if (!line) continue
    doc.text(cellText(line), left, y, { width: contentWidth, align: 'center' })
    y = doc.y + 3
  }

  if (stats.length) {
    y += 5
    doc.fillColor(SUBTITLE_COLOR).font('Helvetica-Bold').fontSize(10)
    doc.text(stats.join('   •   '), left, y, { width: contentWidth, align: 'center' })
    y = doc.y + 6
  }

  doc.moveTo(left, y).lineTo(left + contentWidth, y).lineWidth(1).strokeColor(ROW_BORDER).stroke()
  y += 16

  y = drawSectionHeading(doc, 'Graduates', y)
  y = drawTable(doc, {
    columns: graduatesRows?.columns || [],
    rows: graduatesRows?.rows || [],
    startY: y,
  })

  const groups = (takenGroups || []).filter((group) => Array.isArray(group.rows) && group.rows.length)
  if (groups.length) {
    y += 16
    y = drawSectionHeading(doc, 'Courses Taken', y)

    for (const group of groups) {
      if (y + 76 > pageBottom()) {
        doc.addPage()
        y = doc.page.margins.top
      }

      y = drawGroupHeading(doc, group, y)

      const rows = group.rows.map((row) =>
        row.map((cell, i) => {
          const column = TAKEN_COLUMNS[i]
          if (column?.key === 'result') {
            const color = RESULT_COLORS[cellText(cell)]
            return color ? { text: cell, color } : cell
          }
          return cell
        })
      )

      y = drawTable(doc, { columns: TAKEN_COLUMNS, rows, startY: y })
      y += 8
    }
  }

  doc.end()
}
