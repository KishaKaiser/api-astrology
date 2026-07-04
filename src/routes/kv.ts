import { Router, Response } from "express"
import { requireAuth, AuthRequest } from "../middleware/auth"
import { prisma } from "../lib/prisma"

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /kv/:key – return value for key, or null if not found
router.get("/kv/:key", async (req: AuthRequest, res: Response) => {
  try {
    const key = readParam(req.params.key)
    const entry = await prisma.kVEntry.findUnique({
      where: { userId_key: { userId: req.userId as string, key } },
    })
    res.json({ value: entry ? entry.value : null })
  } catch (err) {
    console.error("GET /kv/:key error", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /kv/:key – upsert a value for key
router.put("/kv/:key", async (req: AuthRequest, res: Response) => {
  try {
    const key = readParam(req.params.key)
    const { value } = req.body as { value: unknown }

    if (value === undefined) {
      res.status(400).json({ error: "value is required in request body" })
      return
    }

    const entry = await prisma.kVEntry.upsert({
      where: { userId_key: { userId: req.userId as string, key } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { value: value as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { userId: req.userId as string, key, value: value as any },
    })
    res.json({ value: entry.value })
  } catch (err) {
    console.error("PUT /kv/:key error", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// DELETE /kv/:key – delete entry for key
router.delete("/kv/:key", async (req: AuthRequest, res: Response) => {
  try {
    const key = readParam(req.params.key)
    await prisma.kVEntry.deleteMany({
      where: { userId: req.userId as string, key },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error("DELETE /kv/:key error", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

function readParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export default router
