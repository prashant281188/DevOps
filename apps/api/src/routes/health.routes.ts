import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

// Liveness probe: verifies process is alive
router.get("/live", (_req, res) => {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
});

// Readiness probe: verifies dependent tier (PostgreSQL) is accessible
router.get("/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ready", database: "connected" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", database: "disconnected" });
  }
});

export default router;
