import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, Check, Clock3, LogIn, LogOut, Printer, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@workspace/api-client-react";
import { getBusinessName } from "@/lib/brand-settings";

type AttendanceRecord={
  id:number; staff_id:number; staff_name:string; username:string; attendance_date:string;
  check_in_at:string; check_out_at?:string; status:"pending"|"approved"|"rejected";
  owner_note?:string; duration_minutes?:number; early_checkout?:boolean; checkout_note?:string;
};
type StaffSummary={id:number;name:string;days:number;minutes:number};
const currentMonth=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo",year:"numeric",month:"2-digit"}).format(new Date());
const formatTime=(value?:string)=>value?new Date(value).toLocaleTimeString("en-LK",{hour:"2-digit",minute:"2-digit"}):"—";
const duration=(minutes?:number)=>minutes==null?"Not checked out":`${Math.floor(minutes/60)}h ${minutes%60}m`;
const dateKey=(value:string)=>String(value).slice(0,10);

export default function Attendance(){
  const {toast}=useToast();
  const {data:settings}=useGetSettings();
  const businessName=getBusinessName(settings as any);
  const [month,setMonth]=useState(currentMonth());
  const [role,setRole]=useState<"owner"|"staff">("staff");
  const [today,setToday]=useState("");
  const [records,setRecords]=useState<AttendanceRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const [earlyCheckout,setEarlyCheckout]=useState(false);
  const [checkoutNote,setCheckoutNote]=useState("");
  const [selectedStaff,setSelectedStaff]=useState<StaffSummary|null>(null);
  const [selectedDay,setSelectedDay]=useState<AttendanceRecord|null>(null);
  const [printMode,setPrintMode]=useState(false);

  const request=async(url:string,options?:RequestInit)=>{
    const r=await fetch(url,{credentials:"include",cache:"no-store",...options,headers:options?.body?{"Content-Type":"application/json",...(options.headers||{})}:options?.headers});
    const b=await r.json().catch(()=>({})); if(!r.ok)throw new Error(b.error||"Request failed"); return b;
  };
  const load=async()=>{setLoading(true);try{const data=await request(`/api/admin/attendance?month=${encodeURIComponent(month)}`);setRole(data.role);setToday(data.today);setRecords(data.records||[]);}catch(e:any){toast({title:"Attendance could not load",description:e.message,variant:"destructive"});}finally{setLoading(false);}};
  useEffect(()=>{load();},[month]);
  useEffect(()=>{setSelectedStaff(null);setSelectedDay(null);},[month]);
  useEffect(()=>{const done=()=>setPrintMode(false);window.addEventListener("afterprint",done);return()=>window.removeEventListener("afterprint",done);},[]);
  const printAttendance=()=>{setPrintMode(true);window.setTimeout(()=>window.print(),120);};
  const todayRecord=records.find(r=>dateKey(r.attendance_date)===today);
  const act=async(url:string,body?:any)=>{setBusy(true);try{await request(url,{method:"POST",body:body?JSON.stringify(body):undefined});toast({title:"Attendance updated"});await load();return true;}catch(e:any){toast({title:"Could not update attendance",description:e.message,variant:"destructive"});return false;}finally{setBusy(false);}};
  const submitCheckout=async()=>{
    if(earlyCheckout&&!checkoutNote.trim()){toast({title:"Please add an early-leave reason",variant:"destructive"});return;}
    if(await act(`/api/admin/attendance/${todayRecord?.id}/check-out`,{earlyCheckout,note:checkoutNote.trim()})){setCheckoutOpen(false);setEarlyCheckout(false);setCheckoutNote("");}
  };
  const approved=records.filter(r=>r.status==="approved");
  const totalMinutes=approved.reduce((s,r)=>s+Number(r.duration_minutes||0),0);
  const byStaff=useMemo(()=>Object.values(records.reduce((acc:Record<string,StaffSummary>,r)=>{
    const key=String(r.staff_id); acc[key]||={id:r.staff_id,name:r.staff_name,days:0,minutes:0};
    if(r.status==="approved"){acc[key].days++;acc[key].minutes+=Number(r.duration_minutes||0);} return acc;
  },{})).sort((a,b)=>a.name.localeCompare(b.name)),[records]);
  const staffRecords=selectedStaff?records.filter(r=>r.staff_id===selectedStaff.id):[];
  const recordByDate=new Map(staffRecords.map(r=>[dateKey(r.attendance_date),r]));
  const [year,monthNumber]=month.split("-").map(Number);
  const calendarDays=Array.from({length:new Date(year,monthNumber,0).getDate()},(_,index)=>index+1);
  const leading=(new Date(year,monthNumber-1,1).getDay()+6)%7;

  return <div className="space-y-5">
    <style>{`@media print{
      @page{size:A4 portrait;margin:11mm}
      html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
      body> *:not(.attendance-print-root){display:none!important}
      .attendance-print-root{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;color:#111827!important;overflow:visible!important}
      .attendance-print-root table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
      .attendance-print-root thead{display:table-header-group!important}
      .attendance-print-root tfoot{display:table-footer-group!important}
      .attendance-print-root tr{break-inside:avoid!important;page-break-inside:avoid!important}
      .attendance-print-root .print-section{break-inside:auto!important}
      .attendance-print-root .print-keep{break-inside:avoid!important;page-break-inside:avoid!important}
      .attendance-print-root th,.attendance-print-root td{overflow-wrap:anywhere!important;word-break:normal!important}
    }`}</style>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><CalendarCheck className="text-pink-500"/><h1 className="text-2xl font-black">Attendance</h1></div><p className="mt-1 text-sm text-gray-500">{role==="owner"?"Click a staff member to open their monthly calendar.":"Request today's check-in and record your check-out time."}</p></div>
      <div className="flex gap-2"><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="input-field w-auto"/><button onClick={load} className="rounded-xl border bg-white p-3"><RefreshCw size={16}/></button>{role==="owner"&&<button onClick={printAttendance} className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 text-xs font-black text-white"><Printer size={15}/>Print A4 Report</button>}</div>
    </div>

    {role==="staff"&&<div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white"><div className="text-xs font-bold uppercase tracking-widest text-white/70">Today · {today}</div><h2 className="mt-1 text-2xl font-black">{todayRecord?todayRecord.status==="approved"?"Attendance approved":todayRecord.status==="pending"?"Waiting for Owner approval":"Request rejected":"Ready to check in?"}</h2></div>
      <div className="p-5">{!todayRecord||todayRecord.status==="rejected"
        ?<button disabled={busy} onClick={()=>act("/api/admin/attendance/check-in")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white disabled:opacity-50"><LogIn/>Request Today Check-In</button>
        :<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Check-in</div><b>{formatTime(todayRecord.check_in_at)}</b></div><div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Status</div><b className={todayRecord.status==="approved"?"text-emerald-600":"text-amber-600"}>{todayRecord.status.toUpperCase()}</b></div>{todayRecord.check_out_at?<div className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-400">Check-out</div><b>{formatTime(todayRecord.check_out_at)}</b>{todayRecord.early_checkout&&<div className="mt-1 text-[10px] font-black text-rose-600">LEFT EARLY</div>}</div>:<button disabled={busy} onClick={()=>setCheckoutOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 p-4 font-black text-white"><LogOut size={18}/>Check Out</button>}</div>}
        {todayRecord?.owner_note&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Owner note: {todayRecord.owner_note}</div>}
        {todayRecord?.checkout_note&&<div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">Checkout note: {todayRecord.checkout_note}</div>}
      </div>
    </div>}

    {role==="owner"&&<><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-400">APPROVED DAYS</div><div className="mt-1 text-2xl font-black">{approved.length}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-400">TOTAL RECORDED TIME</div><div className="mt-1 text-2xl font-black">{duration(totalMinutes)}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-400">PENDING REQUESTS</div><div className="mt-1 text-2xl font-black text-amber-600">{records.filter(r=>r.status==="pending").length}</div></div></div>
      {records.some(r=>r.status==="pending")&&<div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5"><h2 className="font-black text-amber-900">Pending Check-In Requests</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{records.filter(r=>r.status==="pending").map(r=><div key={r.id} className="rounded-2xl border border-amber-100 bg-white p-4"><div className="flex justify-between"><div><b>{r.staff_name}</b><div className="text-xs text-gray-400">{dateKey(r.attendance_date)} · {formatTime(r.check_in_at)}</div></div><Clock3 className="text-amber-500"/></div><div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>act(`/api/admin/attendance/${r.id}/decision`,{status:"approved"})} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white"><Check size={14}/>Approve</button><button disabled={busy} onClick={()=>{const note=window.prompt("Reason (optional)")||"";act(`/api/admin/attendance/${r.id}/decision`,{status:"rejected",note});}} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-50 py-2.5 text-xs font-black text-rose-600"><X size={14}/>Reject</button></div></div>)}</div></div>}
    </>}

    <div id="attendance-report" className="rounded-3xl border bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-black">{role==="owner"?"Monthly Attendance Report":"My Monthly Attendance"}</h2><p className="text-xs text-gray-400">{month}</p></div>
      {role==="owner"&&byStaff.length>0&&<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{byStaff.map(s=><button type="button" key={s.id} onClick={()=>{setSelectedStaff(s);setSelectedDay(null);}} className="rounded-xl bg-gray-50 p-3 text-left transition hover:bg-pink-50 hover:ring-2 hover:ring-pink-100"><b>{s.name}</b><div className="text-xs text-gray-500">{s.days} approved days · {duration(s.minutes)}</div><div className="mt-2 text-[10px] font-black uppercase tracking-wide text-pink-500">Open calendar</div></button>)}</div>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-y text-left text-xs text-gray-400"><th className="py-3">Date</th>{role==="owner"&&<th>Staff</th>}<th>Check In</th><th>Check Out</th><th>Time</th><th>Status / Note</th></tr></thead><tbody>{records.map(r=><tr key={r.id} className="border-b"><td className="py-3">{dateKey(r.attendance_date)}</td>{role==="owner"&&<td className="font-bold">{r.staff_name}</td>}<td>{formatTime(r.check_in_at)}</td><td>{formatTime(r.check_out_at)}</td><td>{duration(r.duration_minutes)}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-black ${r.status==="approved"?"bg-emerald-50 text-emerald-600":r.status==="pending"?"bg-amber-50 text-amber-600":"bg-rose-50 text-rose-600"}`}>{r.status.toUpperCase()}</span>{r.early_checkout&&<div className="mt-1 max-w-xs text-xs font-semibold text-rose-600">Left early: {r.checkout_note}</div>}</td></tr>)}</tbody></table>{!records.length&&<div className="py-16 text-center text-sm text-gray-400">{loading?"Loading attendance…":"No attendance records for this month"}</div>}</div>
    </div>

    {checkoutOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">Confirm Check Out</h2><p className="mt-1 text-sm text-gray-500">Your current time will be saved.</p></div><button onClick={()=>setCheckoutOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X size={18}/></button></div><label className="mt-5 flex items-start gap-3 rounded-2xl border bg-gray-50 p-4"><input type="checkbox" checked={earlyCheckout} onChange={e=>setEarlyCheckout(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-500"/><span><b className="text-sm">I am leaving early today</b><span className="mt-1 block text-xs text-gray-500">A reason is required so the Owner can review it.</span></span></label>{earlyCheckout&&<label className="mt-4 block text-xs font-bold text-gray-600">Reason *<textarea value={checkoutNote} onChange={e=>setCheckoutNote(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Medical appointment" className="mt-2 w-full resize-none rounded-2xl border p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-pink-200"/></label>}<div className="mt-5 flex gap-2"><button onClick={()=>setCheckoutOpen(false)} className="flex-1 rounded-xl border py-3 text-sm font-bold text-gray-600">Cancel</button><button disabled={busy||earlyCheckout&&!checkoutNote.trim()} onClick={submitCheckout} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white disabled:opacity-40">Confirm Check Out</button></div></div></div>}

    {selectedStaff&&role==="owner"&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><div className="text-xs font-black uppercase tracking-widest text-pink-500">Attendance Calendar · {month}</div><h2 className="mt-1 text-2xl font-black">{selectedStaff.name}</h2><p className="text-sm text-gray-500">{selectedStaff.days} approved days · {duration(selectedStaff.minutes)}</p></div><button onClick={()=>setSelectedStaff(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X size={20}/></button></div><div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-gray-400">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><div key={day} className="py-2">{day}</div>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({length:leading}).map((_,i)=><div key={`blank-${i}`} />)}{calendarDays.map(day=>{const key=`${month}-${String(day).padStart(2,"0")}`;const record=recordByDate.get(key);return <button key={day} type="button" onClick={()=>record&&setSelectedDay(record)} className={`min-h-16 rounded-xl border p-1.5 text-left transition sm:min-h-20 sm:p-2 ${record?.status==="approved"?"border-emerald-200 bg-emerald-50":record?.status==="pending"?"border-amber-200 bg-amber-50":record?.status==="rejected"?"border-rose-200 bg-rose-50":"border-gray-100 bg-gray-50"} ${record?"hover:ring-2 hover:ring-pink-200":"cursor-default"}`}><span className="text-xs font-black">{day}</span>{record&&<><div className="mt-1 truncate text-[9px] font-bold uppercase sm:text-[10px]">{record.status}</div><div className="hidden text-[10px] text-gray-500 sm:block">{formatTime(record.check_in_at)}–{formatTime(record.check_out_at)}</div>{record.early_checkout&&<div className="mt-1 text-[8px] font-black text-rose-600 sm:text-[9px]">LEFT EARLY</div>}</>}</button>})}</div><div className="mt-5 rounded-2xl border bg-gray-50 p-4">{selectedDay?<div className="grid gap-3 sm:grid-cols-4"><div><div className="text-[10px] font-bold text-gray-400">DATE</div><b>{dateKey(selectedDay.attendance_date)}</b></div><div><div className="text-[10px] font-bold text-gray-400">CHECK IN</div><b>{formatTime(selectedDay.check_in_at)}</b></div><div><div className="text-[10px] font-bold text-gray-400">CHECK OUT</div><b>{formatTime(selectedDay.check_out_at)}</b></div><div><div className="text-[10px] font-bold text-gray-400">RECORDED TIME</div><b>{duration(selectedDay.duration_minutes)}</b></div>{selectedDay.checkout_note&&<div className="sm:col-span-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><b>Early checkout reason:</b> {selectedDay.checkout_note}</div>}{selectedDay.owner_note&&<div className="sm:col-span-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700"><b>Owner note:</b> {selectedDay.owner_note}</div>}</div>:<p className="text-sm text-gray-500">Select an attended day to see check-in, check-out and notes.</p>}</div></div></div>}
    {printMode&&createPortal(<AttendancePrintReport month={month} role={role} records={records} byStaff={byStaff} approvedCount={approved.length} totalMinutes={totalMinutes} businessName={businessName}/>,document.body)}
  </div>;
}


function AttendancePrintReport({month,role,records,byStaff,approvedCount,totalMinutes,businessName}:{month:string;role:"owner"|"staff";records:AttendanceRecord[];byStaff:StaffSummary[];approvedCount:number;totalMinutes:number;businessName:string}){
  const pending=records.filter(r=>r.status==="pending").length;
  const rejected=records.filter(r=>r.status==="rejected").length;
  return <main className="attendance-print-root hidden font-sans">
    <header className="print-keep border-b-[3px] border-slate-950 pb-4">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="text-[9pt] font-black uppercase tracking-[0.18em] text-pink-600">{businessName} · Attendance Administration</div>
          <h1 className="mt-1 text-[22pt] font-black leading-tight text-slate-950">{role==="owner"?"Monthly Attendance Report":"My Monthly Attendance Report"}</h1>
          <p className="mt-1 text-[9pt] text-slate-500">Reporting period: <b className="text-slate-800">{month}</b> · Generated {new Date().toLocaleString("en-LK")}</p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-right text-[7.5pt] font-bold leading-4 text-indigo-700">
          {businessName}
        </div>
      </div>
    </header>

    <section className="print-keep mt-4 grid grid-cols-4 gap-2">
      <MetricBox label="Total records" value={String(records.length)}/>
      <MetricBox label="Approved days" value={String(approvedCount)}/>
      <MetricBox label="Recorded time" value={duration(totalMinutes)}/>
      <MetricBox label="Pending / Rejected" value={`${pending} / ${rejected}`}/>
    </section>

    {role==="owner"&&byStaff.length>0&&<section className="print-section mt-5">
      <h2 className="mb-2 text-[10pt] font-black uppercase tracking-wider text-slate-700">Staff Summary</h2>
      <table className="text-[8.5pt]">
        <thead><tr className="bg-slate-950 text-white"><th className="w-[52%] px-2 py-2 text-left">Staff member</th><th className="w-[20%] px-2 py-2 text-center">Approved</th><th className="w-[28%] px-2 py-2 text-right">Recorded time</th></tr></thead>
        <tbody>{byStaff.map((x,i)=><tr key={x.id} className={i%2?"bg-slate-50":"bg-white"}><td className="border-b border-slate-200 px-2 py-2 font-bold">{x.name}</td><td className="border-b border-slate-200 px-2 py-2 text-center">{x.days} days</td><td className="border-b border-slate-200 px-2 py-2 text-right">{duration(x.minutes)}</td></tr>)}</tbody>
      </table>
    </section>}

    <section className="print-section mt-5">
      <h2 className="mb-2 text-[10pt] font-black uppercase tracking-wider text-slate-700">Detailed Attendance</h2>
      <table className="text-[7.5pt] leading-[1.35]">
        <thead><tr className="bg-slate-950 text-white">
          <th className="w-[12%] px-1.5 py-2 text-left">Date</th>
          {role==="owner"&&<th className="w-[18%] px-1.5 py-2 text-left">Staff</th>}
          <th className="w-[12%] px-1.5 py-2 text-left">Check in</th>
          <th className="w-[12%] px-1.5 py-2 text-left">Check out</th>
          <th className="w-[13%] px-1.5 py-2 text-left">Time</th>
          <th className={`${role==="owner"?"w-[33%]":"w-[51%]"} px-1.5 py-2 text-left`}>Status / Notes</th>
        </tr></thead>
        <tbody>{records.map((r,i)=><tr key={r.id} className={i%2?"bg-slate-50":"bg-white"}>
          <td className="border-b border-slate-200 px-1.5 py-2 align-top">{dateKey(r.attendance_date)}</td>
          {role==="owner"&&<td className="border-b border-slate-200 px-1.5 py-2 align-top font-bold">{r.staff_name}</td>}
          <td className="border-b border-slate-200 px-1.5 py-2 align-top">{formatTime(r.check_in_at)}</td>
          <td className="border-b border-slate-200 px-1.5 py-2 align-top">{formatTime(r.check_out_at)}</td>
          <td className="border-b border-slate-200 px-1.5 py-2 align-top">{duration(r.duration_minutes)}</td>
          <td className="border-b border-slate-200 px-1.5 py-2 align-top"><b className={r.status==="approved"?"text-emerald-700":r.status==="pending"?"text-amber-700":"text-rose-700"}>{r.status.toUpperCase()}</b>{r.early_checkout&&<div className="mt-0.5 font-bold text-rose-700">Left early: {r.checkout_note||"No note"}</div>}{r.owner_note&&<div className="mt-0.5 text-slate-600">Owner: {r.owner_note}</div>}</td>
        </tr>)}</tbody>
      </table>
      {!records.length&&<div className="border border-slate-200 py-12 text-center text-[9pt] text-slate-400">No attendance records for this period.</div>}
    </section>

    <footer className="print-keep mt-6 border-t border-slate-300 pt-2 text-[7pt] leading-4 text-slate-400">
      Internal attendance report · {businessName} · Generated from approved/pending attendance records for {month}.
    </footer>
  </main>
}
function MetricBox({label,value}:{label:string;value:string}){return <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div className="text-[6.5pt] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-0.5 text-[11pt] font-black text-slate-900">{value}</div></div>}
