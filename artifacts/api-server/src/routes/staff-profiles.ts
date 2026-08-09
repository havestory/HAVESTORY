import crypto from "node:crypto";
import { Router } from "express";
import { pool } from "@workspace/db";
import { requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";
import { ensureTeamTables } from "../lib/team-access";

const router=Router();
router.use(requireOwner);

function key(){
 const secret=process.env.SESSION_SECRET;
 if(!secret)throw new Error("SESSION_SECRET is required for staff HR profile encryption");
 return crypto.createHash("sha256").update("havestory:staff-hr-profile:v1:").update(secret).digest();
}
function encrypt(value:string){const iv=crypto.randomBytes(12),c=crypto.createCipheriv("aes-256-gcm",key(),iv);const body=Buffer.concat([c.update(value,"utf8"),c.final()]);return[iv.toString("base64url"),c.getAuthTag().toString("base64url"),body.toString("base64url")].join(".")}
function decrypt(value:string){const[iv,tag,body]=String(value||"").split(".");if(!iv||!tag||!body)throw new Error("Invalid encrypted staff profile");const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));d.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([d.update(Buffer.from(body,"base64url")),d.final()]).toString("utf8")}
const text=(v:unknown,n=1000)=>String(v??"").trim().slice(0,n);
const list=(v:unknown,n=30)=>Array.isArray(v)?v.slice(0,n):[];

function cleanProfile(body:any){
 const p=body?.personal||{},e=body?.employment||{},em=body?.emergency||{},cv=body?.cv||{},links=cv?.links||{};
 return {
  personal:{displayName:text(p.displayName,160),preferredName:text(p.preferredName,120),dateOfBirth:text(p.dateOfBirth,30),nationality:text(p.nationality,80),nicPassport:text(p.nicPassport,80),personalEmail:text(p.personalEmail,180),phone:text(p.phone,80),altPhone:text(p.altPhone,80),address:text(p.address,800)},
  employment:{employeeId:text(e.employeeId,80),jobTitle:text(e.jobTitle,160),department:text(e.department,120),employmentType:text(e.employmentType,80),joinedDate:text(e.joinedDate,30),workLocation:text(e.workLocation,180),reportingTo:text(e.reportingTo,160),employmentStatus:text(e.employmentStatus,80)||"Active"},
  emergency:{name:text(em.name,160),relationship:text(em.relationship,100),phone:text(em.phone,80),altPhone:text(em.altPhone,80)},
  cv:{
   headline:text(cv.headline,180),professionalSummary:text(cv.professionalSummary,3000),careerObjective:text(cv.careerObjective,2000),
   skills:list(cv.skills,40).map(x=>text(x,120)).filter(Boolean),
   languages:list(cv.languages,20).map((x:any)=>({language:text(x?.language,100),level:text(x?.level,80)})),
   education:list(cv.education,20).map((x:any)=>({qualification:text(x?.qualification,180),institution:text(x?.institution,180),field:text(x?.field,160),startDate:text(x?.startDate,30),endDate:text(x?.endDate,30),grade:text(x?.grade,80),description:text(x?.description,1000)})),
   experience:list(cv.experience,30).map((x:any)=>({jobTitle:text(x?.jobTitle,160),company:text(x?.company,180),location:text(x?.location,160),startDate:text(x?.startDate,30),endDate:text(x?.endDate,30),current:!!x?.current,description:text(x?.description,1500)})),
   certifications:list(cv.certifications,30).map((x:any)=>({name:text(x?.name,180),issuer:text(x?.issuer,180),date:text(x?.date,30),credentialId:text(x?.credentialId,160)})),
   projects:list(cv.projects,20).map((x:any)=>({name:text(x?.name,180),role:text(x?.role,140),description:text(x?.description,1200),link:text(x?.link,500)})),
   references:list(cv.references,10).map((x:any)=>({name:text(x?.name,160),position:text(x?.position,160),company:text(x?.company,180),phone:text(x?.phone,80),email:text(x?.email,180)})),
   links:{linkedin:text(links.linkedin,500),portfolio:text(links.portfolio,500),github:text(links.github,500)},
   interests:list(cv.interests,30).map(x=>text(x,100)).filter(Boolean)
  }
 };
}
async function ensure(){
 await ensureTeamTables();
 await pool.query(`CREATE TABLE IF NOT EXISTS staff_hr_profiles(
  id BIGSERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL UNIQUE REFERENCES admin_staff(id) ON DELETE CASCADE,
  profile_blob TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 )`);
}
router.get("/staff/:staffId/profile",async(req,res)=>{
 try{await ensure();const id=parseIdParam(req,res,"staffId");if(!id)return;const staff=await pool.query("SELECT id,name,username,permissions,active,created_at,last_login_at FROM admin_staff WHERE id=$1",[id]);if(!staff.rows[0]){res.status(404).json({error:"Staff account not found"});return;}const q=await pool.query("SELECT profile_blob,created_at,updated_at FROM staff_hr_profiles WHERE staff_id=$1",[id]);const row=q.rows[0];res.setHeader("Cache-Control","no-store, private");res.json({staff:staff.rows[0],profile:row?JSON.parse(decrypt(row.profile_blob)):null,createdAt:row?.created_at||null,updatedAt:row?.updated_at||null});}
 catch(e){req.log.error(e);res.status(500).json({error:"Could not load staff profile"});}
});
router.put("/staff/:staffId/profile",async(req,res)=>{
 try{await ensure();const id=parseIdParam(req,res,"staffId");if(!id)return;const staff=await pool.query("SELECT id FROM admin_staff WHERE id=$1",[id]);if(!staff.rows[0]){res.status(404).json({error:"Staff account not found"});return;}const profile=cleanProfile(req.body);await pool.query(`INSERT INTO staff_hr_profiles(staff_id,profile_blob) VALUES($1,$2) ON CONFLICT(staff_id) DO UPDATE SET profile_blob=EXCLUDED.profile_blob,updated_at=NOW()`,[id,encrypt(JSON.stringify(profile))]);res.setHeader("Cache-Control","no-store, private");res.json({ok:true,profile});}
 catch(e){req.log.error(e);res.status(500).json({error:"Could not save staff profile"});}
});
export default router;
