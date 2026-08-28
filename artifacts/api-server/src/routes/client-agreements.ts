import crypto from "node:crypto";
import { Router, type Request } from "express";
import { safeUpload, validateUploadedFile } from "../lib/upload-policy";
import { pool } from "@workspace/db";
import { requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

const publicRouter = Router();
const adminRouter = Router();

function key(): Buffer {
  const secret=process.env.SESSION_SECRET;
  if(!secret) throw new Error("SESSION_SECRET is required for agreement encryption");
  return crypto.createHash("sha256").update("havestory:client-agreement:v1:").update(secret).digest();
}
function encrypt(value:Buffer|string){
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);
  const body=Buffer.concat([cipher.update(value),cipher.final()]);
  return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),body.toString("base64url")].join(".");
}
function decrypt(value:string){
  const [iv,tag,body]=String(value||"").split(".");
  const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));
  d.setAuthTag(Buffer.from(tag,"base64url"));
  return Buffer.concat([d.update(Buffer.from(body,"base64url")),d.final()]);
}
const sha=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
const safe=(v:unknown,n=1000)=>String(v??"").trim().slice(0,n);

async function ensureTable(){
  await pool.query(`CREATE TABLE IF NOT EXISTS client_agreements(
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    token_hash TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    agreement_text TEXT NOT NULL,
    document_hash TEXT NOT NULL,
    brand_name TEXT NOT NULL DEFAULT 'HAVESTORY',
    operator_name TEXT NOT NULL DEFAULT 'HAVESTORY',
    client_name_snapshot TEXT NOT NULL,
    client_business_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    signer_blob TEXT,
    signature_blob TEXT,
    signature_mime TEXT,
    audit_blob TEXT,
    consent_text TEXT,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT client_agreements_status_check CHECK(status IN ('pending','signed','void'))
  )`);
}
const upload = safeUpload({ maxFileSize: 3 * 1024 * 1024, maxFiles: 1, maxFields: 8 });
function documentPayload(x:any){return JSON.stringify({title:x.title,agreementText:x.agreement_text,brandName:x.brand_name,operatorName:x.operator_name,clientName:x.client_name_snapshot,clientBusiness:x.client_business_snapshot||""});}

publicRouter.get("/:token",async(req,res)=>{
 try{
  await ensureTable(); const token=String(req.params.token||""); if(token.length<30){res.status(404).json({error:"Agreement link not found"});return;}
  const q=await pool.query("SELECT title,agreement_text,document_hash,brand_name,operator_name,client_name_snapshot,client_business_snapshot,status,signed_at,created_at FROM client_agreements WHERE token_hash=$1 LIMIT 1",[sha(token)]);
  const row=q.rows[0]; if(!row){res.status(404).json({error:"Agreement link not found"});return;}
  res.setHeader("Cache-Control","no-store, private"); res.json(row);
 }catch(e){req.log.error(e);res.status(500).json({error:"Could not load agreement"});}
});
publicRouter.post("/:token/sign",upload.single("signature"),async(req:Request,res)=>{
 try{
  await ensureTable(); const token=String(req.params.token||"");
  const q=await pool.query("SELECT * FROM client_agreements WHERE token_hash=$1 LIMIT 1",[sha(token)]); const row=q.rows[0];
  if(!row){res.status(404).json({error:"Agreement link not found"});return;}
  if(row.status!=="pending"){res.status(409).json({error:row.status==="signed"?"Agreement is already signed":"Agreement is no longer available"});return;}
  if(sha(documentPayload(row))!==row.document_hash){res.status(409).json({error:"Agreement integrity check failed"});return;}
  if(String(req.body.consent)!=="true"||!req.file){res.status(400).json({error:"Explicit consent and electronic signature are required"});return;}
  if(!validateUploadedFile(req.file)){res.status(400).json({error:"The uploaded file contents do not match their declared type."});return;}
  const signer={name:safe(req.body.signerName,160),nic:safe(req.body.nicNumber,80),phone:safe(req.body.phone,80),email:safe(req.body.email,180)};
  if(!signer.name||!signer.nic||!signer.phone){res.status(400).json({error:"Signer name, NIC/ID and phone are required"});return;}
  const consent="I have read this agreement, agree to its terms, and intend my electronic signature to sign it.";
  const audit={ip:req.ip||req.socket.remoteAddress||"",userAgent:safe(req.get("user-agent"),600),signedAt:new Date().toISOString(),documentHash:row.document_hash};
  const u=await pool.query(`UPDATE client_agreements SET status='signed',signer_blob=$2,signature_blob=$3,signature_mime=$4,audit_blob=$5,consent_text=$6,signed_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING signed_at`,
   [row.id,encrypt(JSON.stringify(signer)),encrypt(req.file.buffer),req.file.mimetype,encrypt(JSON.stringify(audit)),consent]);
  if(!u.rows[0]){res.status(409).json({error:"Agreement was already signed"});return;}
  res.setHeader("Cache-Control","no-store, private"); res.json({ok:true,status:"signed",signedAt:u.rows[0].signed_at,documentHash:row.document_hash});
 }catch(e){req.log.error(e);res.status(500).json({error:"Could not sign agreement"});}
});

adminRouter.use(requireOwner);
adminRouter.get("/clients/:clientId/agreements",async(req,res)=>{
 try{await ensureTable();const id=parseIdParam(req,res,"clientId");if(!id)return;
 const q=await pool.query("SELECT id,title,status,document_hash,brand_name,operator_name,signed_at,created_at FROM client_agreements WHERE client_id=$1 ORDER BY created_at DESC",[id]);res.json(q.rows);}
 catch(e){req.log.error(e);res.status(500).json({error:"Could not load agreements"});}
});
adminRouter.post("/clients/:clientId/agreements",async(req,res)=>{
 try{
  await ensureTable();const id=parseIdParam(req,res,"clientId");if(!id)return;
  const cq=await pool.query("SELECT id,name,business_name FROM clients WHERE id=$1 AND deleted_at IS NULL",[id]);const c=cq.rows[0];
  if(!c){res.status(404).json({error:"Client not found"});return;}
  const title=safe(req.body.title,180),text=safe(req.body.agreementText,30000);
  if(!title||text.length<20){res.status(400).json({error:"Agreement title and full terms are required"});return;}
  const brandName=safe(req.body.brandName,120)||"HAVESTORY",operatorName=safe(req.body.operatorName,180)||"HAVESTORY";
  const snap={title,agreement_text:text,brand_name:brandName,operator_name:operatorName,client_name_snapshot:c.name,client_business_snapshot:c.business_name||""};
  const token=crypto.randomBytes(32).toString("base64url"),docHash=sha(documentPayload(snap));
  const q=await pool.query(`INSERT INTO client_agreements(client_id,token_hash,title,agreement_text,document_hash,brand_name,operator_name,client_name_snapshot,client_business_snapshot)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,title,status,document_hash,brand_name,operator_name,created_at`,
   [id,sha(token),title,text,docHash,brandName,operatorName,c.name,c.business_name||null]);
  res.setHeader("Cache-Control","no-store, private");res.status(201).json({...q.rows[0],path:`/client-agreement/${token}`});
 }catch(e){req.log.error(e);res.status(500).json({error:"Could not create agreement"});}
});
adminRouter.get("/client-agreements/:agreementId",async(req,res)=>{
 try{
  await ensureTable();const id=parseIdParam(req,res,"agreementId");if(!id)return;
  const q=await pool.query("SELECT * FROM client_agreements WHERE id=$1 LIMIT 1",[id]);const r=q.rows[0];if(!r){res.status(404).json({error:"Agreement not found"});return;}
  res.setHeader("Cache-Control","no-store, private");res.json({id:r.id,clientId:r.client_id,title:r.title,agreementText:r.agreement_text,documentHash:r.document_hash,brandName:r.brand_name,operatorName:r.operator_name,clientName:r.client_name_snapshot,clientBusiness:r.client_business_snapshot,status:r.status,signer:r.signer_blob?JSON.parse(decrypt(r.signer_blob).toString("utf8")):null,audit:r.audit_blob?JSON.parse(decrypt(r.audit_blob).toString("utf8")):null,consentText:r.consent_text,signedAt:r.signed_at,createdAt:r.created_at,hasSignature:!!r.signature_blob});
 }catch(e){req.log.error(e);res.status(500).json({error:"Could not load agreement"});}
});
adminRouter.get("/client-agreements/:agreementId/signature",async(req,res)=>{
 try{await ensureTable();const id=parseIdParam(req,res,"agreementId");if(!id)return;
 const q=await pool.query("SELECT signature_blob,signature_mime FROM client_agreements WHERE id=$1",[id]);if(!q.rows[0]?.signature_blob){res.status(404).end();return;}
 res.setHeader("Content-Type",q.rows[0].signature_mime||"image/png");res.setHeader("Cache-Control","no-store, private");res.send(decrypt(q.rows[0].signature_blob));}
 catch(e){req.log.error(e);res.status(500).end();}
});
export { publicRouter as publicClientAgreementsRouter };
export default adminRouter;
