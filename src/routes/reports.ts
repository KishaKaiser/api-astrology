import { Router, Request, Response } from "express"
import { existsSync } from "node:fs"
import { createReadStream } from "node:fs"
import { join, resolve } from "node:path"
import { prisma } from "../lib/prisma"
import { generateChartData } from "../lib/chart-engine"
import { buildReportText, writeChartPdf } from "../lib/pdf-report"

const router = Router()
const reportsDir = resolve(process.env.REPORTS_DIR || "reports")

interface ReportPayload {
  reportId?: string
  orderId?: string
  productName?: string
  formData?: {
    fullName?: string
    birthDate?: string
    birthTime?: string
    birthCity?: string
    birthState?: string
    birthCountry?: string
    birthLatitude?: number | string | null
    birthLongitude?: number | string | null
    timezone?: string | null
    notes?: string | null
  }
}

router.get("/reports/download/:fileName", (req: Request, res: Response) => {
  const rawFileName = Array.isArray(req.params.fileName) ? req.params.fileName[0] : req.params.fileName
  const fileName = rawFileName.replace(/[^a-z0-9._-]/gi, "")
  const filePath = join(reportsDir, fileName)
  if (!fileName || !existsSync(filePath)) {
    res.status(404).json({ message: "Report file not found" })
    return
  }

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`)
  createReadStream(filePath).pipe(res)
})

router.post(["/reports/generate", "/generate-report", "/api/generate-report", "/api/pl-cms/generate-report"], async (req: Request, res: Response) => {
  const authError = validateServiceToken(req)
  if (authError) {
    res.status(authError.status).json({ message: authError.message })
    return
  }

  const payload = normalizePayload(req.body as ReportPayload)
  const formData = payload.formData
  const missing = validatePayload(payload)
  if (missing.length > 0 || !formData) {
    res.status(400).json({ message: `Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}` })
    return
  }

  try {
    const chart = generateChartData({
      name: formData.fullName || "Astrology Chart",
      date: formData.birthDate || "",
      time: formData.birthTime || "",
      location: [formData.birthCity, formData.birthState, formData.birthCountry].filter(Boolean).join(", "),
      latitude: toNumber(formData.birthLatitude),
      longitude: toNumber(formData.birthLongitude),
      timezone: formData.timezone,
    })
    const reportText = buildReportText(chart)
    const fileName = `${slugify(formData.fullName || "astrology-chart")}-${payload.reportId}.pdf`

    await writeChartPdf(chart, { reportsDir, fileName })

    await prisma.reportRequest.upsert({
      where: { reportId: payload.reportId! },
      update: {
        orderId: payload.orderId || null,
        productName: payload.productName || null,
        formData,
        reportText,
      },
      create: {
        reportId: payload.reportId!,
        orderId: payload.orderId || null,
        productName: payload.productName || null,
        formData,
        reportText,
      },
    })

    res.json({
      reportId: payload.reportId,
      status: "completed",
      reportUrl: buildReportUrl(req, fileName),
      reportText,
      fileName,
    })
  } catch (err) {
    console.error("POST /reports/generate error", err)
    res.status(500).json({ message: "Failed to generate astrology report" })
  }
})

function normalizePayload(payload: ReportPayload): ReportPayload {
  const formData = payload.formData || {}
  const reportId = payload.reportId || `${payload.orderId || "plcms"}-${Date.now()}`

  return {
    ...payload,
    reportId,
    formData: {
      ...formData,
      fullName: cleanString(formData.fullName),
      birthDate: cleanString(formData.birthDate),
      birthTime: cleanString(formData.birthTime),
      birthCity: cleanString(formData.birthCity),
      birthState: cleanString(formData.birthState),
      birthCountry: cleanString(formData.birthCountry),
      birthLatitude: formData.birthLatitude,
      birthLongitude: formData.birthLongitude,
      timezone: cleanString(formData.timezone),
      notes: cleanString(formData.notes),
    },
  }
}

function validateServiceToken(req: Request): { status: number; message: string } | null {
  const expected = process.env.PL_CMS_API_KEY || process.env.ASTROLOGY_SERVICE_TOKEN
  if (!expected) return null

  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  const apiKey = req.headers["x-api-key"]
  const headerKey = Array.isArray(apiKey) ? apiKey[0] : apiKey
  if (token !== expected && headerKey !== expected) {
    return { status: 401, message: "Invalid astrology service token" }
  }
  return null
}

function validatePayload(payload: ReportPayload) {
  const missing: string[] = []
  if (!payload.reportId) missing.push("reportId")
  if (!payload.formData?.fullName) missing.push("formData.fullName")
  if (!payload.formData?.birthDate) missing.push("formData.birthDate")
  if (!payload.formData?.birthTime) missing.push("formData.birthTime")
  if (!payload.formData?.birthCity) missing.push("formData.birthCity")
  if (!payload.formData?.birthState) missing.push("formData.birthState")
  if (!payload.formData?.birthCountry) missing.push("formData.birthCountry")
  return missing
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "astrology-chart"
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildReportUrl(req: Request, fileName: string) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`
  return `${baseUrl.replace(/\/+$/, "")}/reports/download/${encodeURIComponent(fileName)}`
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined
}

export default router
