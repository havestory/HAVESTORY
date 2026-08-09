import { useEffect, useState, useRef } from "react";
import { useGetNotices } from "@workspace/api-client-react";
import { X, Bell, ChevronRight } from "lucide-react";

const AUTO_ADVANCE_MS = 9000;
const seenThisLoad = new Set<number>();
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const SESSION_KEY = "pb_popup_shown";

/* Pink-purple palette shared across all variants */
const PP = {
  from:    "#ec4899",
  to:      "#9333ea",
  light:   "#fdf2f8",
  mid:     "#f9a8d4",
  border:  "#f3e8ff",
  text:    "#6b21a8",
  sub:     "#a855f7",
};

export default function NoticePopup() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  const { data: allNotices } = useGetNotices({}, { query: { enabled: !isAdmin } });
  const [open, setOpen]       = useState(false);
  const [pidx, setPidx]       = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const popups = isAdmin ? [] : (Array.isArray(allNotices) ? allNotices : []).filter((n: any) => n.enabled && n.placement === "popup");

  useEffect(() => {
    if (isAdmin || popups.length === 0) return;
    const unseen = popups.filter((p: any) => !seenThisLoad.has(p.id));
    if (unseen.length === 0 || open) return;
    const isFirst = !sessionStorage.getItem(SESSION_KEY);
    const delay = isFirst ? rand(2000, 10000) : rand(300, 800);
    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setPidx(popups.indexOf(unseen[0]));
      setOpen(true);
      requestAnimationFrame(() => setTimeout(() => setVisible(true), 20));
    }, delay);
    return () => clearTimeout(t);
  }, [allNotices]);

  const getUnseen = () => popups.filter((p: any) => !seenThisLoad.has(p.id));

  const advance = (currentPidx: number) => {
    const popup = popups[currentPidx];
    if (!popup) { closePopup(); return; }
    seenThisLoad.add(popup.id);
    const remaining = popups.filter((p: any) => !seenThisLoad.has(p.id));
    if (remaining.length > 0) {
      setVisible(false);
      setTimeout(() => {
        setPidx(popups.indexOf(remaining[0]));
        setProgress(0);
        requestAnimationFrame(() => setTimeout(() => setVisible(true), 20));
      }, 280);
    } else {
      closePopup();
    }
  };

  const closePopup = () => {
    setVisible(false);
    setTimeout(() => setOpen(false), 320);
  };

  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(0);
      return;
    }
    const unseen = getUnseen();
    if (unseen.length <= 1) return;
    setProgress(0);
    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100));
    }, 50);
    timerRef.current = setTimeout(() => advance(pidx), AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [open, pidx]);

  if (isAdmin || !open || popups.length === 0) return null;

  const popup = popups[pidx];
  if (!popup) { closePopup(); return null; }
  const remaining = popups.filter((p: any) => !seenThisLoad.has(p.id) && p.id !== popup.id);
  const hasMore   = remaining.length > 0;
  const dismiss   = () => advance(pidx);
  const closeAll  = () => { popups.forEach((p: any) => seenThisLoad.add(p.id)); closePopup(); };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{
        background:    visible ? "rgba(88,28,135,0.18)" : "rgba(88,28,135,0)",
        backdropFilter: visible ? "blur(8px)" : "blur(0px)",
        transition:    "background 0.35s ease, backdrop-filter 0.35s ease",
      }}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          maxWidth:   400,
          borderRadius: 28,
          background:  "#fff",
          border:      `1.5px solid ${PP.border}`,
          boxShadow:   "0 24px 80px rgba(147,51,234,0.18), 0 4px 24px rgba(236,72,153,0.12)",
          transform:   visible ? "translateY(0) scale(1)" : "translateY(28px) scale(0.94)",
          opacity:     visible ? 1 : 0,
          transition:  "transform 0.38s cubic-bezier(0.34,1.46,0.64,1), opacity 0.3s ease",
        }}
      >
        {popup.imageUrl ? (
          /* ── IMAGE VARIANT ── */
          <div>
            {/* Image — bigger */}
            <div className="relative">
              <img
                src={popup.imageUrl}
                alt={popup.topic ?? "Notice"}
                className="w-full object-cover block"
                style={{ height: 330, objectPosition: "center" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />

              {/* Soft pink-purple gradient fade at bottom */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(253,242,248,0.96) 100%)" }}
              />

              {/* Progress bar top */}
              {hasMore && (
                <div className="absolute top-3.5 left-3.5 right-14">
                  <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.5)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: PP.from, transition: "none" }} />
                  </div>
                </div>
              )}

              {/* Close */}
              <button
                onClick={closeAll}
                className="absolute top-3 right-3 flex items-center justify-center transition-all hover:scale-105"
                style={{
                  width: 30, height: 30, borderRadius: 999,
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(8px)",
                  border: `1px solid ${PP.border}`,
                  color: PP.sub,
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Topic + action — light pink-purple panel */}
            <div className="px-5 pt-3 pb-5" style={{ background: PP.light }}>
              {popup.topic && (
                <p
                  className="font-bold text-lg leading-snug mb-3"
                  style={{ color: PP.text }}
                >
                  {popup.topic}
                </p>
              )}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={dismiss}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${PP.from}, ${PP.to})`, boxShadow: `0 4px 18px rgba(236,72,153,0.35)` }}
                >
                  Got it
                </button>
                {hasMore && (
                  <button
                    onClick={dismiss}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-2xl text-xs font-semibold shrink-0 transition-colors hover:bg-purple-50"
                    style={{ border: `1.5px solid ${PP.border}`, color: PP.sub }}
                  >
                    Next <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── NO-IMAGE VARIANT ── */
          <div>
            {/* Pink-purple gradient header */}
            <div
              className="relative px-6 pt-6 pb-5 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${PP.from}, ${PP.to})` }}
            >
              {/* Decorative soft orbs */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.1)", transform: "translate(35%, -35%)" }} />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.07)", transform: "translate(-35%, 35%)" }} />

              <div className="flex items-start justify-between relative z-10">
                <div
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}
                >
                  <Bell size={20} className="text-white" />
                </div>
                <button
                  onClick={closeAll}
                  className="flex items-center justify-center transition-all hover:scale-105"
                  style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}
                >
                  <X size={13} />
                </button>
              </div>

              {popup.topic && (
                <p className="mt-3 font-bold text-xl text-white leading-snug relative z-10">
                  {popup.topic}
                </p>
              )}

              {hasMore && (
                <div className="mt-3 relative z-10">
                  <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "rgba(255,255,255,0.9)", transition: "none" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Action area */}
            <div className="px-6 py-5" style={{ background: PP.light }}>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={dismiss}
                  className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${PP.from}, ${PP.to})`, boxShadow: "0 4px 18px rgba(236,72,153,0.35)" }}
                >
                  Got it
                </button>
                {hasMore && (
                  <button
                    onClick={dismiss}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-2xl text-xs font-semibold shrink-0 transition-colors hover:bg-purple-50"
                    style={{ border: `1.5px solid ${PP.border}`, color: PP.sub }}
                  >
                    Next <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
