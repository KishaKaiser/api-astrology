import { Router, Response } from "express"
import { requireAuth, AuthRequest } from "../middleware/auth"
import { prisma } from "../lib/prisma"

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /me  – return current user profile
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) {
      res.status(404).json({ error: "User not found" })
      return
    }
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  } catch (err) {
    console.error("GET /me error", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /me  – update user profile fields
router.put("/me", async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.body as { username?: string }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(username !== undefined && { username }),
      },
    })
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      res.status(404).json({ error: "User not found" })
      return
    }
    console.error("PUT /me error", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
