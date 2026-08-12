import { Router } from "express";
import { getAdminAuth, requireAdmin } from "../lib/auth-cookie";
import { queueDeletionRequest } from "../lib/team-access";
import { parseIdParam } from "../lib/parse-id";
import { db } from "@workspace/db";
import { crmProjectsTable } from "@workspace/db/schema";
import { eq, desc, isNull } from "drizzle-orm";

const router = Router();

// CRM projects are admin-only.
router.use(requireAdmin);

async function generateProjectId(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 8; attempt++) {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    const candidate = `HS-CRM-${suffix}`;
    const [existing] = await db.select({ id: crmProjectsTable.id }).from(crmProjectsTable).where(eq(crmProjectsTable.projectId, candidate)).limit(1);
    if (!existing) return candidate;
  }
  return `HS-CRM-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

router.get("/", async (req, res) => {
  try {
    const projects = await db.select().from(crmProjectsTable).where(isNull(crmProjectsTable.deletedAt)).orderBy(desc(crmProjectsTable.createdAt));
    res.json(projects);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch CRM projects" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, clientName, clientId, serviceTypeId, status, description, totalValue, amountPaid, startDate, dueDate, notes } = req.body;
    const projectId = await generateProjectId();
    const [project] = await db.insert(crmProjectsTable).values({
      projectId,
      title,
      clientName,
      clientId: clientId ? parseInt(clientId) : null,
      serviceTypeId: serviceTypeId ? parseInt(serviceTypeId) : null,
      status: status || "planning",
      description,
      totalValue: totalValue ? parseInt(totalValue) : 0,
      amountPaid: amountPaid ? parseInt(amountPaid) : 0,
      startDate,
      dueDate,
      notes,
    }).returning();
    res.status(201).json(project);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create CRM project" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { title, clientName, clientId, serviceTypeId, status, description, totalValue, amountPaid, startDate, dueDate, notes } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientId !== undefined) updateData.clientId = clientId ? parseInt(clientId) : null;
    if (serviceTypeId !== undefined) updateData.serviceTypeId = serviceTypeId ? parseInt(serviceTypeId) : null;
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;
    if (totalValue !== undefined) updateData.totalValue = parseInt(totalValue) || 0;
    if (amountPaid !== undefined) updateData.amountPaid = parseInt(amountPaid) || 0;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (notes !== undefined) updateData.notes = notes;
    const [project] = await db.update(crmProjectsTable).set(updateData).where(eq(crmProjectsTable.id, id)).returning();
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update CRM project" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const [project]=await db.select().from(crmProjectsTable).where(eq(crmProjectsTable.id,id)).limit(1);
    if(!project)return res.status(404).json({error:"Project not found"});
    if(getAdminAuth(req)?.role==="staff"){
      const request=await queueDeletionRequest(req,"crm_project",id,project.projectId || project.title,req.body?.reason);
      return res.status(202).json({success:true,pendingApproval:true,message:"Project deletion request sent to Owner",request});
    }
    await db.delete(crmProjectsTable).where(eq(crmProjectsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete CRM project" });
  }
});

export default router;
