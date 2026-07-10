import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ChartData } from "./chart-engine"

export async function writeChartPdf(chart: ChartData, options: { reportsDir: string; fileName: string }) {
  await mkdir(options.reportsDir, { recursive: true })
  const text = buildPdfText(chart)
  const pdf = createSimplePdf(text)
  const filePath = join(options.reportsDir, options.fileName)
  await writeFile(filePath, pdf)
  return filePath
}

export function buildReportText(chart: ChartData) {
  return buildPdfText(chart).join("\n")
}

function buildPdfText(chart: ChartData) {
  const coordinateNote = chart.coordinateSource === "fallback"
    ? "Coordinates could not be resolved. House placements use 0,0 and should be reviewed."
    : `Coordinates: ${chart.latitude.toFixed(4)}, ${chart.longitude.toFixed(4)} (${chart.coordinateSource})`

  return [
    "Psychic Link Astrology Chart",
    "",
    `Name: ${chart.name}`,
    `Birth date: ${chart.date}`,
    `Birth time: ${chart.time} (${chart.timezone})`,
    `Birth location: ${chart.location}`,
    coordinateNote,
    `House system: ${chart.houseSystem}`,
    `Ascendant: ${formatDegree(chart.ascendant)}`,
    `Midheaven: ${formatDegree(chart.midheaven)}`,
    "",
    "Planet Positions",
    ...chart.planets.map((planet) => `${planet.name}: ${planet.degree.toFixed(2)} ${planet.sign}, House ${planet.house}`),
    "",
    "House Cusps",
    ...chart.houses.map((house) => `House ${house.number}: ${formatDegree(house.cusp)} ${house.sign}`),
    "",
    "Major Aspects",
    ...(chart.aspects.length
      ? chart.aspects.map((aspect) => `${aspect.planet1} ${aspect.type} ${aspect.planet2} (orb ${aspect.orb.toFixed(2)})`)
      : ["No major aspects found within the configured orbs."]),
  ]
}

function createSimplePdf(lines: string[]) {
  const objects: string[] = []
  const escapedLines = lines.flatMap((line) => wrapLine(line, 92)).map(escapePdfText)
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    "14 TL",
    ...escapedLines.map((line, index) => `${index === 0 ? "" : "T*"}(${line}) Tj`),
    "ET",
  ].join("\n")

  objects.push("<< /Type /Catalog /Pages 2 0 R >>")
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>")
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf, "binary")
}

function wrapLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line]
  const words = line.split(" ")
  const wrapped: string[] = []
  let current = ""
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength) {
      wrapped.push(current)
      current = word
    } else {
      current = `${current} ${word}`.trim()
    }
  }
  if (current) wrapped.push(current)
  return wrapped
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function formatDegree(value: number) {
  return `${value.toFixed(2)} deg`
}
