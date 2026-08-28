/**
 * Public custom project request form
 * POST /custom-projects  — no auth required (public-facing enquiry form)
 */
import { Router } from "express";
import { safeUpload, validateUploadedFile } from "../lib/upload-policy";
import { db } from "@workspace/db";
import { crmProjectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Accept multipart (referenceImage optional) or urlencoded fallback
const upload = safeUpload({
  maxFileSize: 5 * 1024 * 1024,
  maxFiles: 1,
  maxFields: 20,
});

function txt(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}

async function generateProjectId(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 8; attempt++) {
    let suffix = "";
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    const candidate = `HS-REQ-${suffix}`;
    const [existing] = await db
      .select({ id: crmProjectsTable.id })
      .from(crmProjectsTable)
      .where(eq(crmProjectsTable.projectId, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `HS-REQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

router.post(
  "/",
  upload.single("referenceImage"),
  async (req, res) => {
    try {
      const b = (req.body ?? {}) as Record<string, string>;
      if (req.file && !validateUploadedFile(req.file)) {
        return res.status(400).json({ error: "The uploaded file contents do not match their declared type." });
      }

      const customerName = txt(b.customerName, 120);
      const phone        = txt(b.phone, 30);
      const projectType  = txt(b.projectType, 80);
      const description  = txt(b.description, 2000);

      if (!customerName || !phone || !projectType || !description) {
        return res.status(400).json({
          error: "customerName, phone, projectType and description are required",
        });
      }

      // Pack extra fields + contact info into the notes column as JSON
      const notes = JSON.stringify({
        phone,
        email:           txt(b.email),
        businessName:    txt(b.businessName),
        requiredSize:    txt(b.requiredSize),
        quantity:        txt(b.quantity),
        budget:          txt(b.budget),
        deadline:        txt(b.deadline),
        deliveryAddress: txt(b.deliveryAddress),
        additionalNotes: txt(b.additionalNotes, 1000),
        hasReferenceImage: !!req.file,
        submittedAt:     new Date().toISOString(),
        source:          "public_form",
      });

      const projectId = await generateProjectId();

      const [project] = await db
        .insert(crmProjectsTable)
        .values({
          projectId,
          title:      projectType,
          clientName: customerName,
          description,
          notes,
          status:     "enquiry",
        })
        .returning({
          id:        crmProjectsTable.id,
          projectId: crmProjectsTable.projectId,
        });

      return res.status(201).json({ id: project.id, projectId: project.projectId, success: true });
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Failed to submit project request" });
    }
  }
);

export default router;
