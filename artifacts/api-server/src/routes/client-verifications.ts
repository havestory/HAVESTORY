import crypto from "node:crypto";
import { Router, type Request } from "express";
import multer from "multer";
import { pool } from "@workspace/db";
import { requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const publicRouter = Router();
const adminRouter = Router();

type ProfileData = {
  fullName: string;
  nicNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
};

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for client verification encryption");
  return crypto.createHash("sha256").update("havestory:client-verification:v1:").update(secret).digest();
}

function encrypt(value: Buffer | string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(value), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

function decrypt(value: string): Buffer {
  const [ivRaw, tagRaw, bodyRaw] = String(value || "").split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("Invalid encrypted verification payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(bodyRaw, "base64url")), decipher.final()]);
}

const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_verifications (
      id BIGSERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      profile_blob TEXT,
      selfie_blob TEXT,
      selfie_mime TEXT,
      id_front_blob TEXT,
      id_front_mime TEXT,
      id_back_blob TEXT,
      id_back_mime TEXT,
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      owner_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT client_verifications_status_check CHECK (status IN ('pending','submitted','approved','rejected'))
    )
  `);
}

function decodeProfile(blob: string | null): ProfileData | null {
  if (!blob) return null;
  return JSON.parse(decrypt(blob).toString("utf8")) as ProfileData;
}

function safeText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 3, fields: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    cb(null, allowed.has(file.mimetype));
  },
});

function uploaded(req: Request, field: string): { buffer: Buffer; mimetype: string } | undefined {
  const files = (req as any).files as Record<string, Array<{ buffer: Buffer; mimetype: string }>> | undefined;
  return files?.[field]?.[0];
}

// Public link: deliberately returns no client PII.
publicRouter.get("/:token", async (req, res) => {
  try {
    await ensureTable();
    const token = String(req.params.token || "");
    if (token.length < 30) { res.status(404).json({ error: "Verification link not found" }); return; }
    const result = await pool.query(
      "SELECT status FROM client_verifications WHERE token_hash=$1 LIMIT 1",
      [tokenHash(token)],
    );
    if (!result.rows[0]) { res.status(404).json({ error: "Verification link not found" }); return; }
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ status: result.rows[0].status });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not load verification" });
  }
});

publicRouter.post(
  "/:token/submit",
  upload.fields([{ name: "selfie", maxCount: 1 }, { name: "idFront", maxCount: 1 }, { name: "idBack", maxCount: 1 }]),
  async (req, res) => {
    try {
      await ensureTable();
      const token = String(req.params.token || "");
      const found = await pool.query(
        "SELECT id,status FROM client_verifications WHERE token_hash=$1 LIMIT 1",
        [tokenHash(token)],
      );
      const row = found.rows[0];
      if (!row) { res.status(404).json({ error: "Verification link not found" }); return; }
      if (!["pending", "rejected"].includes(row.status)) {
        res.status(409).json({ error: row.status === "submitted" ? "Verification is already awaiting review" : "Verification is already approved" });
        return;
      }
      const selfie = uploaded(req, "selfie");
      const idFront = uploaded(req, "idFront");
      const idBack = uploaded(req, "idBack");
      if (!selfie || !idFront || !idBack) {
        res.status(400).json({ error: "Live selfie, ID front and ID back are all required" });
        return;
      }
      const profile: ProfileData = {
        fullName: safeText(req.body.fullName, 160),
        nicNumber: safeText(req.body.nicNumber, 80),
        dateOfBirth: safeText(req.body.dateOfBirth, 30),
        phone: safeText(req.body.phone, 80),
        email: safeText(req.body.email, 180),
        address: safeText(req.body.address, 800),
      };
      if (!profile.fullName || !profile.nicNumber || !profile.address) {
        res.status(400).json({ error: "Full name, NIC/ID number and address are required" });
        return;
      }
      await pool.query(
        `UPDATE client_verifications SET
          status='submitted', profile_blob=$2,
          selfie_blob=$3,selfie_mime=$4,
          id_front_blob=$5,id_front_mime=$6,
          id_back_blob=$7,id_back_mime=$8,
          submitted_at=NOW(), reviewed_at=NULL, owner_note=NULL, updated_at=NOW()
         WHERE id=$1`,
        [
          row.id, encrypt(JSON.stringify(profile)),
          encrypt(selfie.buffer), selfie.mimetype,
          encrypt(idFront.buffer), idFront.mimetype,
          encrypt(idBack.buffer), idBack.mimetype,
        ],
      );
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ ok: true, status: "submitted" });
    } catch (error) {
      req.log.error(error);
      res.status(500).json({ error: "Could not submit verification" });
    }
  },
);

adminRouter.use(requireOwner);

adminRouter.post("/clients/:clientId/verification-link", async (req, res) => {
  try {
    await ensureTable();
    const clientId = parseIdParam(req, res, "clientId");
    if (!clientId) { res.status(400).json({ error: "Invalid client id" }); return; }
    const client = await pool.query("SELECT id FROM clients WHERE id=$1 AND deleted_at IS NULL", [clientId]);
    if (!client.rows[0]) { res.status(404).json({ error: "Client not found" }); return; }
    const current = await pool.query("SELECT status FROM client_verifications WHERE client_id=$1", [clientId]);
    if (["submitted", "approved"].includes(current.rows[0]?.status)) {
      res.status(409).json({ error: current.rows[0].status === "submitted" ? "Verification is awaiting owner review" : "Client verification is already approved" });
      return;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO client_verifications(client_id,token_hash,status)
       VALUES($1,$2,'pending')
       ON CONFLICT(client_id) DO UPDATE SET
         token_hash=EXCLUDED.token_hash,status='pending',reviewed_at=NULL,owner_note=NULL,updated_at=NOW()`,
      [clientId, tokenHash(token)],
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ path: `/client-verification/${token}`, status: "pending" });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not create verification link" });
  }
});

adminRouter.get("/clients/:clientId/verification", async (req, res) => {
  try {
    await ensureTable();
    const clientId = parseIdParam(req, res, "clientId");
    if (!clientId) { res.status(400).json({ error: "Invalid client id" }); return; }
    const result = await pool.query(
      `SELECT id,status,profile_blob,selfie_blob,id_front_blob,id_back_blob,
              submitted_at,reviewed_at,owner_note,created_at,updated_at
       FROM client_verifications WHERE client_id=$1 LIMIT 1`,
      [clientId],
    );
    const row = result.rows[0];
    res.setHeader("Cache-Control", "no-store, private");
    if (!row) { res.json({ exists: false }); return; }
    res.json({
      exists: true,
      status: row.status,
      profile: decodeProfile(row.profile_blob),
      hasSelfie: !!row.selfie_blob,
      hasIdFront: !!row.id_front_blob,
      hasIdBack: !!row.id_back_blob,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      ownerNote: row.owner_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not load verification" });
  }
});

adminRouter.get("/clients/:clientId/verification/image/:kind", async (req, res) => {
  try {
    await ensureTable();
    const clientId = parseIdParam(req, res, "clientId");
    if (!clientId) { res.status(400).end(); return; }
    const kinds: Record<string, [string, string]> = {
      selfie: ["selfie_blob", "selfie_mime"],
      "id-front": ["id_front_blob", "id_front_mime"],
      "id-back": ["id_back_blob", "id_back_mime"],
    };
    const pair = kinds[String(req.params.kind)];
    if (!pair) { res.status(404).end(); return; }
    const result = await pool.query(
      `SELECT ${pair[0]} AS blob,${pair[1]} AS mime FROM client_verifications WHERE client_id=$1 LIMIT 1`,
      [clientId],
    );
    if (!result.rows[0]?.blob) { res.status(404).end(); return; }
    const mime = result.rows[0].mime || "image/jpeg";
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (String(req.query.download || "") === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="client-${clientId}-${String(req.params.kind)}.${ext}"`);
    }
    res.send(decrypt(result.rows[0].blob));
  } catch (error) {
    req.log.error(error);
    res.status(500).end();
  }
});

adminRouter.post("/clients/:clientId/verification-decision", async (req, res) => {
  try {
    await ensureTable();
    const clientId = parseIdParam(req, res, "clientId");
    const decision = String(req.body?.decision || "");
    if (!clientId || !["approved", "rejected"].includes(decision)) {
      res.status(400).json({ error: "Invalid verification decision" });
      return;
    }
    const result = await pool.query(
      `UPDATE client_verifications
       SET status=$2, reviewed_at=NOW(), owner_note=$3, updated_at=NOW()
       WHERE client_id=$1 AND status='submitted'
       RETURNING status,reviewed_at,owner_note`,
      [clientId, decision, safeText(req.body?.note, 1000) || null],
    );
    if (!result.rows[0]) { res.status(409).json({ error: "Only a submitted verification can be reviewed" }); return; }
    res.json(result.rows[0]);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Could not update verification" });
  }
});

export { publicRouter as publicClientVerificationsRouter };
export default adminRouter;
