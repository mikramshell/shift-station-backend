import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireManager } from "../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  phone: z.string().min(7),
  password: z.string().min(4),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Phone and password required" });

  const { phone, password } = parsed.data;
  const employee = await db.employee.findUnique({ where: { phone } });
  if (!employee || !employee.active) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, employee.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: employee.id, role: employee.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });

  res.json({
    token,
    user: { id: employee.id, name: employee.name, role: employee.role },
  });
});

// Manager creates a new employee account (sets a temp password they text/hand over)
const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  password: z.string().min(6),
  locationIds: z.array(z.string()).min(1),
  role: z.enum(["MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
});

authRouter.post("/employees", requireAuth, requireManager, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, phone, email, password, locationIds, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const employee = await db.employee.create({
    data: {
      name, phone, email, passwordHash, role,
      locations: { connect: locationIds.map((id) => ({ id })) },
    },
  });

  res.status(201).json({ id: employee.id, name: employee.name });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.employee.update({ where: { id: req.user.id }, data: { passwordHash } });
  res.json({ ok: true });
});
