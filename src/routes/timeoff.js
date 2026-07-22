import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireManager } from "../middleware/auth.js";
import { notifyEmployee } from "../services/notify.js";

export const timeoffRouter = Router();

const createSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

// Employee submits a request
timeoffRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "startDate and endDate required" });

  const request = await db.timeOffRequest.create({
    data: {
      employeeId: req.user.id,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      reason: parsed.data.reason,
    },
  });

  // Notify all managers a new request needs review
  const managers = await db.employee.findMany({ where: { role: "MANAGER", active: true } });
  const requester = await db.employee.findUnique({ where: { id: req.user.id } });
  for (const m of managers) {
    await notifyEmployee(m.id, `${requester.name} requested time off ${parsed.data.startDate} to ${parsed.data.endDate}.`);
  }

  res.status(201).json(request);
});

// List: employees see their own, managers see everyone's
timeoffRouter.get("/", requireAuth, async (req, res) => {
  const where = req.user.role === "MANAGER" ? {} : { employeeId: req.user.id };
  const requests = await db.timeOffRequest.findMany({
    where,
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

// Manager approves or denies
timeoffRouter.patch("/:id", requireAuth, requireManager, async (req, res) => {
  const { status } = req.body; // "APPROVED" | "DENIED"
  if (!["APPROVED", "DENIED"].includes(status)) return res.status(400).json({ error: "Invalid status" });

  const request = await db.timeOffRequest.update({
    where: { id: req.params.id },
    data: { status, resolvedAt: new Date(), resolvedBy: req.user.id },
  });

  await notifyEmployee(
    request.employeeId,
    `Your time-off request (${request.startDate.toDateString()} – ${request.endDate.toDateString()}) was ${status.toLowerCase()}.`
  );

  res.json(request);
});
