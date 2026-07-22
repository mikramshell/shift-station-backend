import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const notifications = await db.notification.findMany({
    where: { employeeId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(notifications);
});

notificationsRouter.post("/:id/read", requireAuth, async (req, res) => {
  await db.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
