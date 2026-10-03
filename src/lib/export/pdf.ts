import { jsPDF } from 'jspdf'
import autoTable, { type CellInput, type RowInput } from 'jspdf-autotable'
import { svg2pdf } from 'svg2pdf.js'
import type { Project } from '../../model/types'
import type { Assignment } from '../assign'
import { plotViewBox, renderPlotSvg } from './plotSvg'
import { inputTables, outputTables, signalTables } from './tables'

/**
 * PDF: Seite 1 (A4 quer) Bühnenplan als Vektorgrafik, danach (A4 hoch) Inputliste,
 * Outputliste, PA-Signalweg und Hinweise. Wird nur beim Export per dynamischem Import geladen.
 */

const M = 12 // Rand in mm
const DARK: [number, number, number] = [27, 31, 36] // AK foreground
const MUTED: [number, number, number] = [91, 100, 114] // AK muted
const RED: [number, number, number] = [163, 53, 42] // AK brk-fg
const AMBER: [number, number, number] = [138, 91, 18] // AK loan-fg
const HEAD: [number, number, number] = [238, 240, 243] // AK background

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** Die PDF-Standardschrift (WinAnsi) kennt keine Pfeile und kein Ω. */
function pdfText(text: string): string {
  return text.replace(/←/g, '<-').replace(/→/g, '->').replace(/Ω/g, 'Ohm')
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function pageSize(doc: jsPDF) {
  return { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() }
}

/** Überschrift; beginnt eine neue Seite, wenn unten zu wenig Platz ist. */
function heading(doc: jsPDF, title: string, y: number): number {
  if (y > pageSize(doc).h - 45) {
    doc.addPage('a4', 'portrait')
    y = M + 4
  }
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...DARK)
  doc.text(title, M, y + 4)
  return y + 8
}

async function drawPlot(doc: jsPDF, project: Project, assignment: Assignment, area: { x: number; y: number; w: number; h: number }) {
  const vb = plotViewBox(project)
  const scale = Math.min(area.w / vb.w, area.h / vb.h) // mm pro SVG-Einheit
  // Knotenradius ca. 4,5 mm, unabhängig von der Bühnengröße
  const k = Math.min(3, Math.max(0.35, 4.5 / (17 * scale)))
  const svgText = renderPlotSvg(project, assignment, k)
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement
  // Zielgröße kommt aus den svg2pdf-Optionen, nicht aus den Pixelmaßen des SVG.
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  // svg2pdf braucht das Element im Dokument (berechnete Styles).
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden'
  holder.appendChild(svg)
  document.body.appendChild(holder)
  try {
    const w = vb.w * scale
    const h = vb.h * scale
    await svg2pdf(svg, doc, { x: area.x + (area.w - w) / 2, y: area.y, width: w, height: h })
    return area.y + h
  } finally {
    holder.remove()
  }
}

export async function buildPdf(project: Project, assignment: Assignment, date = new Date()): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setProperties({ title: `${project.name} – Stageplot`, creator: 'stageplot' })

  // ---------- Seite 1: Bühnenplan ----------
  const page = pageSize(doc)
  const totalIn = project.groups.reduce((n, g) => n + g.channels.length, 0)
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...DARK)
  doc.text(project.name, M, M + 4)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
  const fmt = (m: number) => m.toLocaleString('de-DE')
  doc.text(
    [
      `Bühne ${fmt(project.stage.width)} × ${fmt(project.stage.depth)} m`,
      `${project.boxes.length} Stageboxen`,
      `${totalIn} Inputs`,
      `${project.outputs.length} Outputs`,
      `Stand ${date.toLocaleDateString('de-DE')}`,
    ].join('  ·  '),
    M,
    M + 9.5,
  )

  const plotBottom = await drawPlot(doc, project, assignment, { x: M, y: M + 13, w: page.w - 2 * M, h: page.h - (M + 13) - M - 12 })

  // Legende: Boxen mit Auslastung
  let lx = M
  const ly = Math.min(plotBottom + 4, page.h - M - 8)
  doc.setFontSize(9)
  for (const box of project.boxes) {
    const u = assignment.usage[box.id]
    const label = `Box ${box.name}: ${u.inputsUsed}/${u.inputs} In · ${u.outputsUsed}/${u.outputs} Out`
    doc.setFillColor(...rgb(box.color)).rect(lx, ly - 2.8, 3.5, 3.5, 'F')
    doc.setFont('helvetica', 'bold').setTextColor(...(u.inputsMissing || u.outputsMissing ? RED : DARK))
    doc.text(label, lx + 5, ly)
    lx += doc.getTextWidth(label) + 12
  }

  // ---------- Listen ----------
  doc.addPage('a4', 'portrait')
  const tableBase = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6, textColor: DARK, lineColor: [209, 213, 219] as [number, number, number], lineWidth: 0.2 },
    headStyles: { fillColor: HEAD, textColor: DARK, fontStyle: 'bold' as const },
    margin: { left: M, right: M, top: M, bottom: 16 },
  }

  let y = heading(doc, 'Inputliste', M)
  const inputs = inputTables(project, assignment)
  for (const t of inputs.boxes) {
    const title = `Stagebox ${t.box.name}  ·  ${t.usage}${t.missing ? `  ·  ${t.missing} fehlen` : ''}`
    const body: RowInput[] = t.rows.length
      ? t.rows.map((r, i) => [r.port, r.channel, t.pinned.has(i) ? `${r.group} (fest)` : r.group, r.pickup, r.note, r.distance])
      : [[{ content: 'Keine Kanäle zugeordnet', colSpan: 6, styles: { textColor: MUTED } }]]
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [
        [{ content: title, colSpan: 6, styles: { fillColor: rgb(t.box.color), textColor: [11, 13, 18], fontSize: 10 } }],
        ['Port', 'Kanal', 'Instrument', 'Abnahme', 'Notiz', 'Abstand'],
      ],
      body,
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 16 }, 5: { halign: 'right', cellWidth: 18 } },
    })
    y = finalY(doc) + 6
  }
  if (inputs.unpatched.length) {
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [
        [{ content: `Ohne Input  ·  ${inputs.unpatched.length}`, colSpan: 5, styles: { fillColor: RED, textColor: [255, 255, 255], fontSize: 10 } }],
        ['Port', 'Kanal', 'Instrument', 'Abnahme', 'Notiz'],
      ],
      body: inputs.unpatched.map((r) => [r.port, r.channel, r.group, r.pickup, r.note]),
      columnStyles: { 0: { cellWidth: 16 } },
    })
    y = finalY(doc) + 6
  }

  const outputs = outputTables(project, assignment)
  if (project.outputs.length) {
    y = heading(doc, 'Outputliste', y + 2)
    for (const t of outputs.boxes) {
      const title = `Stagebox ${t.box.name}  ·  ${t.usage}${t.missing ? `  ·  ${t.missing} fehlen` : ''}`
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [
          [{ content: title, colSpan: 4, styles: { fillColor: rgb(t.box.color), textColor: [11, 13, 18], fontSize: 10 } }],
          ['Port', 'Ziel', 'Art', 'Abstand'],
        ],
        body: t.rows.map((r, i) => [r.port, t.pinned.has(i) ? `${r.name} (fest)` : r.name, r.kind, r.distance]),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 3: { halign: 'right', cellWidth: 18 } },
      })
      y = finalY(doc) + 6
    }
    if (outputs.unpatched.length) {
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [
          [{ content: `Ohne Output  ·  ${outputs.unpatched.length}`, colSpan: 3, styles: { fillColor: RED, textColor: [255, 255, 255], fontSize: 10 } }],
          ['Port', 'Ziel', 'Art'],
        ],
        body: outputs.unpatched.map((r) => [r.port, r.name, r.kind]),
        columnStyles: { 0: { cellWidth: 22 } },
      })
      y = finalY(doc) + 6
    }
  }

  const signal = signalTables(project, assignment)
  if (signal.length) {
    y = heading(doc, 'PA-Signalweg', y + 2)
    for (const t of signal) {
      const crossover = t.device.kind === 'crossover'
      const info = pdfText([t.summary, ...t.feeds].join('\n'))
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [
          [{ content: t.title, colSpan: 4, styles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 10 } }],
          [{ content: info, colSpan: 4, styles: { fillColor: HEAD, fontStyle: 'normal', fontSize: 8.5 } }],
          crossover ? ['Ausgang', 'Von', 'Filter · Anschluss', 'An'] : ['Kanal', 'Eingang', 'Leistung', 'An'],
        ],
        body: t.rows.map((r) => [crossover ? `${r.port} ${r.name}` : r.port, r.from, r.detail, r.to].map(pdfText)),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: crossover ? 30 : 18 } },
      })
      y = finalY(doc) + 6
    }
  }

  if (assignment.warnings.length) {
    y = heading(doc, 'Hinweise', y + 2)
    autoTable(doc, {
      ...tableBase,
      theme: 'plain',
      startY: y,
      body: assignment.warnings.map((w): CellInput[] => [
        { content: w.level === 'error' ? 'Fehler' : 'Hinweis', styles: { fontStyle: 'bold', textColor: w.level === 'error' ? RED : AMBER } },
        pdfText(w.message),
      ]),
      columnStyles: { 0: { cellWidth: 18 } },
    })
  }

  // ---------- Fußzeile ----------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const { w, h } = pageSize(doc)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
    doc.text(project.name, M, h - 7)
    doc.text('stageplot', w / 2, h - 7, { align: 'center' })
    doc.text(`Seite ${i} / ${pages}`, w - M, h - 7, { align: 'right' })
  }

  return doc.output('blob')
}
