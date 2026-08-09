import { useEffect, useState } from "react";
import { useGetNotices } from "@workspace/api-client-react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const STYLE_CONFIG: Record<string, { gradient: string }> = {
  info:    { gradient: "linear-gradient(90deg,#2563eb,#3b82f6)" },
  success: { gradient: "linear-gradient(90deg,#16a34a,#10b981)" },
  warning: { gradient: "linear-gradient(90deg,#f97316,#ec4899)" },
  error:   { gradient: "linear-gradient(90deg,#dc2626,#ef4444)" },
};

const INTERVAL_MS = 4500;

export default function NoticeBanner() {
  const { data: allNotices } = useGetNotices();
  const notices = (Array.isArray(allNotices) ? allNotices : []).filter(n => n.enabled && n.placement === "banner");

  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [dir, setDir] = useState<1 | -1>(1);

  const go = (newIdx: number, direction: 1 | -1) => {
    if (phase !== "idle") return;
    setDir(direction);
    setPhase("out");
    setTimeout(() => {
      setIdx(newIdx);
      setPhase("in");
      setTimeout(() => setPhase("idle"), 350);
    }, 300);
  };

  useEffect(() => {
    if (notices.length <= 1) return;
    const timer = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % notices.length;
        go(next, 1);
        return i;
      });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [notices.length]);

  if (dismissed || notices.length === 0) return null;

  const notice = notices[idx % notices.length];
  const cfg = STYLE_CONFIG[notice.style] ?? STYLE_CONFIG.info;

  const prev = () => go((idx - 1 + notices.length) % notices.length, -1);
  const next = () => go((idx + 1) % notices.length, 1);

  const slideStyle: React.CSSProperties = {
    transform:
      phase === "out" ? `translateX(${dir === 1 ? "-40px" : "40px"})`
      : phase === "in" ? "translateX(0)"
      : "translateX(0)",
    opacity: phase === "out" ? 0 : 1,
    transition: phase === "idle" ? "none" : "transform 0.3s ease, opacity 0.3s ease",
  };

  return (
    <div style={{ background: cfg.gradient }} className="py-2 px-4 relative z-30 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm font-medium">
        {notices.length > 1 && (
          <button onClick={prev} className="opacity-70 hover:opacity-100 transition-opacity shrink-0">
            <ChevronLeft size={16} />
          </button>
        )}

        <div className="flex items-center gap-2 text-center" style={slideStyle}>
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.6)" }} />
          <span>{notice.message}</span>
        </div>

        {notices.length > 1 && (
          <>
            <button onClick={next} className="opacity-70 hover:opacity-100 transition-opacity shrink-0">
              <ChevronRight size={16} />
            </button>
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {notices.map((_, i) => (
                <span key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === idx % notices.length ? 14 : 5,
                    height: 5,
                    background: i === idx % notices.length ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
