import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { getBusinessName } from "@/lib/brand-settings";
import { Camera, CheckCircle2, CreditCard, Loader2, ShieldCheck, UserRound, X } from "lucide-react";

type CaptureKey = "selfie" | "idFront" | "idBack";
type CaptureState = Record<CaptureKey, { file: File; url: string } | null>;

const emptyCaptures: CaptureState = { selfie: null, idFront: null, idBack: null };

export default function ClientVerification() {
  const { token } = useParams<{ token: string }>();
  const { data: settings } = useGetSettings();
  const businessName = getBusinessName(settings as any);
  const [status, setStatus] = useState<string>("loading");
  const [form, setForm] = useState({ fullName: "", nicNumber: "", dateOfBirth: "", phone: "", email: "", address: "" });
  const [captures, setCaptures] = useState<CaptureState>(emptyCaptures);
  const [activeCapture, setActiveCapture] = useState<CaptureKey | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch(`/api/client-verifications/${encodeURIComponent(token || "")}`, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Verification link is not valid");
        return r.json();
      })
      .then(data => setStatus(data.status))
      .catch(err => { setSubmitError(err.message || "Verification link is not valid"); setStatus("error"); });
  }, [token]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActiveCapture(null);
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    Object.values(captures).forEach(c => c && URL.revokeObjectURL(c.url));
  }, []);

  const openCamera = async (target: CaptureKey) => {
    setCameraError("");
    streamRef.current?.getTracks().forEach(track => track.stop());
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Live camera is not available on this device/browser.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: target === "selfie" ? "user" : { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setActiveCapture(target);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Camera permission is required.");
    }
  };

  const capturePhoto = () => {
    const target = activeCapture;
    const video = videoRef.current;
    if (!target || !video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `${target}.jpg`, { type: "image/jpeg" });
      setCaptures(current => {
        if (current[target]) URL.revokeObjectURL(current[target]!.url);
        return { ...current, [target]: { file, url: URL.createObjectURL(blob) } };
      });
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!captures.selfie || !captures.idFront || !captures.idBack) {
      setSubmitError("Please capture your live selfie, ID front and ID back.");
      return;
    }
    setSubmitting(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      data.append("selfie", captures.selfie.file);
      data.append("idFront", captures.idFront.file);
      data.append("idBack", captures.idBack.file);
      const response = await fetch(`/api/client-verifications/${encodeURIComponent(token || "")}/submit`, { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Could not submit verification");
      setStatus("submitted");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen grid place-items-center bg-slate-950 text-white"><Loader2 className="animate-spin" /></div>;
  if (status === "submitted" || status === "approved") {
    return <div className="min-h-screen bg-slate-950 px-5 grid place-items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto text-emerald-500" size={54} />
        <h1 className="mt-4 text-2xl font-black text-slate-900">{status === "approved" ? "Verification approved" : "Submitted securely"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{status === "approved" ? `Your ${businessName} client profile is verified.` : `Your details are now waiting for ${businessName} owner review.`}</p>
      </div>
    </div>;
  }
  if (status === "error") return <div className="min-h-screen bg-slate-950 px-5 grid place-items-center text-center text-white"><div><ShieldCheck className="mx-auto mb-4" /><h1 className="text-2xl font-bold">Secure link unavailable</h1><p className="mt-2 text-slate-300">{submitError}</p></div></div>;

  const captureCards: Array<{ key: CaptureKey; title: string; help: string; icon: typeof Camera }> = [
    { key: "selfie", title: "Live selfie", help: "Face the camera in good light", icon: UserRound },
    { key: "idFront", title: "ID — front", help: "Keep every corner visible", icon: CreditCard },
    { key: "idBack", title: "ID — back", help: "Avoid glare and blur", icon: CreditCard },
  ];

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81_0,#0f172a_44%,#020617_100%)] px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
      <header className="bg-slate-950 px-6 py-7 text-white sm:px-9">
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-400"><ShieldCheck size={18} /> {businessName} · Secure client profile</div>
        <h1 className="mt-3 text-3xl font-black">Verify your client profile</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Capture the three photos live and submit your details. Identity images are encrypted and available only to the {businessName} owner for review.</p>
      </header>
      <form onSubmit={submit} className="space-y-7 p-6 sm:p-9">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Full legal name" required value={form.fullName} onChange={v => setForm(f => ({ ...f, fullName: v }))} />
          <Field label="NIC / ID number" required value={form.nicNumber} onChange={v => setForm(f => ({ ...f, nicNumber: v }))} />
          <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={v => setForm(f => ({ ...f, dateOfBirth: v }))} />
          <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Full address *</label>
            <textarea required rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-black text-slate-900">Live captures</h2>
          <p className="mb-4 mt-1 text-xs text-slate-500">Gallery uploads are not used here — please allow camera access.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {captureCards.map(card => {
              const shot = captures[card.key];
              return <button key={card.key} type="button" onClick={() => void openCamera(card.key)} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-amber-300">
                {shot ? <img src={shot.url} alt={card.title} className="h-32 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-slate-100"><card.icon className="text-slate-400" size={30} /></div>}
                <div className="p-3"><div className="font-bold text-slate-900">{card.title}</div><div className="mt-0.5 text-[11px] text-slate-500">{shot ? "Tap to recapture" : card.help}</div></div>
              </button>;
            })}
          </div>
          {cameraError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">{cameraError}</p>}
        </section>

        {submitError && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">{submitError}</div>}
        <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-violet-600 px-5 py-3.5 font-bold text-white shadow-lg disabled:opacity-60">
          {submitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Submit securely for owner review
        </button>
      </form>
    </div>

    {activeCapture && <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between p-4 text-white"><span className="font-bold">{activeCapture === "selfie" ? "Live selfie" : activeCapture === "idFront" ? "ID front" : "ID back"}</span><button type="button" onClick={stopCamera}><X /></button></div>
        <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full bg-black object-cover" />
        <div className="p-4"><button type="button" onClick={capturePhoto} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 font-black text-slate-950"><Camera size={20} /> Capture now</button></div>
      </div>
    </div>}
  </main>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}{required ? " *" : ""}</span><input type={type} required={required} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-500" /></label>;
}
