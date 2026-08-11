import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const router = Router();

async function generateMessageId(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 8; attempt++) {
    let id = "MSG-";
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    const [existing] = await db.select({ id: messagesTable.id }).from(messagesTable).where(eq(messagesTable.messageId, id)).limit(1);
    if (!existing) return id;
  }
  return "MSG-" + Date.now().toString(36).toUpperCase().slice(-6);
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { read } = req.query;
    const msgs = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt));
    const filtered = read !== undefined ? msgs.filter(m => m.isRead === (read === "true")) : msgs;
    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { fullName, phone, email, subject, message } = req.body;
    const messageId = await generateMessageId();
    const [msg] = await db.insert(messagesTable).values({ messageId, fullName, phone, email, subject, message }).returning();
    res.status(201).json(msg);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to submit message" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { isRead } = req.body;
    const [msg] = await db.update(messagesTable).set({ isRead }).where(eq(messagesTable.id, id)).returning();
    if (!msg) return res.status(404).json({ error: "Message not found" });
    res.json(msg);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(messagesTable).where(eq(messagesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
