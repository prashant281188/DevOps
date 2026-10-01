import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { items } from "../db/schema.js";

const router = Router();

const createItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const records = await db.select().from(items);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = createItemSchema.parse(req.body);
    const [inserted] = await db.insert(items).values(payload).returning();
    res.status(201).json(inserted);
  } catch (err) {
    next(err);
  }
});

export default router;
