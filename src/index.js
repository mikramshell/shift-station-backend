import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth.js";
import { employeesRouter } from "./routes/employees.js";
import { schedulesRouter } from "./routes/schedules.js";
import { timeoffRouter } from "./routes/timeoff.js";
import { notificationsRouter } from "./routes/notifications.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })); // basic abuse protection

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/employees", employeesRouter);
app.use("/schedules", schedulesRouter);
app.use("/timeoff", timeoffRouter);
app.use("/notifications", notificationsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Shift Station API running on :${port}`));
