import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireManager } from "../middleware/auth.js";

export const employeesRouter = Router();

// List roster (any signed-in user can see coworkers to know who's on shift)
employeesRouter.get("/", requireAuth, async (req, res) => {
  const employees = await db.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, email: true, role: true, locations: true },
    orderBy: { name: "asc" },
  });
  res.json(employees);
});

employeesRouter.patch("/:id", requireAuth, requireManager, async (req, res) => {
  const { name, phone, email, locationIds, active } = req.body;
  const employee = await db.employee.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(email !== undefined && { email }),
      ...(active !== undefined && { active }),
      ...(locationIds && { locations: { set: locationIds.map((id) => ({ id })) } }),
    },
  });
  res.json(employee);
});

employeesRouter.get("/locations", requireAuth, async (req, res) => {
  const locations = await db.location.findMany({ orderBy: { name: "asc" } });
  res.json(locations);
});

employeesRouter.post("/locations", requireAuth, requireManager, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Location name required" });
  const location = await db.location.create({ data: { name } });
  res.status(201).json(location);
});

// Register a device push token (called from the mobile app after login)
employeesRouter.post("/push-token", requireAuth, async (req, res) => {
  const { token, platform } = req.body;
  if (!token || !platform) return res.status(400).json({ error: "token and platform required" });
  await db.pushToken.upsert({
    where: { token },
    update: { employeeId: req.user.id, platform },
    create: { token, platform, employeeId: req.user.id },
  });
  res.json({ ok: true });
});
