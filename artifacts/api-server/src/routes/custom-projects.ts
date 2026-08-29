/**
 * Public custom project request form
 * POST /custom-projects  — no auth required (public-facing enquiry form)
 */
import { Router } from "express";
import { safeUpload, validateUploadedFile } from "../lib/upload-policy";
import { db, pool } from "@workspace/db";
import { clientsTable, crmProjectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { findClientIdByPhone, replaceClientPhoneClaims } from "../lib/client-dedupe";
import { uploadToCloudinary } from "../lib/cloudinary";

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

      let referenceImageUrl = "";
      if (req.file) {
        const uploaded = await uploadToCloudinary(
          req.file.buffer,
          "havestory/custom-projects",
          req.file.originalname,
        );
        referenceImageUrl = uploaded.url;
      }

      let clientId = await findClientIdByPhone(phone);
      if (!clientId) {
        const [client] = await db.insert(clientsTable).values({
          name: customerName,
          businessName: txt(b.businessName, 160) || null,
          email: txt(b.email, 200) || null,
          phone,
          address: txt(b.deliveryAddress, 500) || null,
          approved: false,
          notes: "Created automatically from the public custom project form.",
        }).returning({ id: clientsTable.id });
        clientId = client.id;
        await replaceClientPhoneClaims(pool, client.id, phone);
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
        referenceImageUrl,
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
          clientId,
          description,
          notes,
          status:     "enquiry",
        })
        .returning({
          id:        crmProjectsTable.id,
          projectId: crmProjectsTable.projectId,
        });

      return res.status(201).json({ id: project.id, projectId: project.projectId, clientId, success: true });
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Failed to submit project request" });
    }
  }
);

export default router;
