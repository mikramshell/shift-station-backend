import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireManager } from "../middleware/auth.js";
import { notifyEmployee } from "../services/notify.js";

export const schedulesRouter = Router();

function startOfDayUTC(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z");
}
function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// GET /schedules?locationId=xxx&weekStart=2026-07-20
// Returns { [employeeId]: [7 shift labels, Mon..Sun] }
schedulesRouter.get("/", requireAuth, async (req, res) => {
  const { locationId, weekStart } = req.query;
  if (!locationId || !weekStart) return res.status(400).json({ error: "locationId and weekStart required" });

  const start = startOfDayUTC(weekStart);
  const end = addDays(start, 7);

  const shifts = await db.shift.findMany({
    where: { locationId, date: { gte: start, lt: end } },
  });

  const byEmployee = {};
  for (const s of shifts) {
    const dayIndex = Math.round((s.date - start) / 86400000);
    if (!byEmployee[s.employeeId]) byEmployee[s.employeeId] = Array(7).fill("X");
    byEmployee[s.employeeId][dayIndex] = s.label;
  }
  res.json(byEmployee);
});

// PUT /schedules  { locationId, weekStart, notify: bool, rows: { [employeeId]: [7 labels] } }
schedulesRouter.put("/", requireAuth, requireManager, async (req, res) => {
  const { locationId, weekStart, rows, notify } = req.body;
  if (!locationId || !weekStart || !rows) {
    return res.status(400).json({ error: "locationId, weekStart, rows required" });
  }
  const start = startOfDayUTC(weekStart);

  const ops = [];
  for (const [employeeId, labels] of Object.entries(rows)) {
    labels.forEach((label, i) => {
      const date = addDays(start, i);
      ops.push(
        db.shift.upsert({
          where: { employeeId_date: { employeeId, date } },
          update: { label, locationId },
          create: { employeeId, date, label, locationId },
        })
      );
    });
  }
  await db.$transaction(ops);

  if (notify) {
    const location = await db.location.findUnique({ where: { id: locationId } });
    for (const employeeId of Object.keys(rows)) {
      await notifyEmployee(employeeId, `Your schedule at ${location.name} for the week of ${weekStart} was updated. Open Shift Station to view it.`);
    }
  }

  res.json({ ok: true });
});
