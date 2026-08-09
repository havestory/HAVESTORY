import { useEffect, useState } from "react";
import { getSettingsCache } from "@/lib/settings-cache";
import { Palette } from "lucide-react";
import { getBusinessName } from "@/lib/brand-settings";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  const settings = getSettingsCache() as any;
  const businessName = getBusinessName(settings);
  const logoUrl: string = settings?.logoUrl || "";
  const tagline: string = settings?.tagline || "";

  useEffect(() => {
    const startedAt = performance.now();
    let finished = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      const minimumVisibleTime = Math.max(0, 1100 - (performance.now() - startedAt));
      exitTimer = setTimeout(() => {
        setLeaving(true);
        exitTimer = setTimeout(onDone, 550);
      }, minimumVisibleTime);
    };

    const windowReady = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });

    const fontsReady =
      "fonts" in document
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();

    const painted = new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    Promise.all([windowReady, fontsReady, painted]).then(finish);
    const safetyTimer = setTimeout(finish, 6000);

    return () => {
      finished = true;
      clearTimeout(safetyTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${businessName || "website"}`}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none"
      style={{
        background: "rgba(12, 10, 8, 0.85)",
        WebkitBackdropFilter: "blur(20px) saturate(135%)",
        backdropFilter: "blur(20px) saturate(135%)",
        opacity: leaving ? 0 : 1,
        visibility: leaving ? "hidden" : "visible",
        transition: "opacity 0.5s ease, visibility 0.5s ease",
        pointerEvents: leaving ? "none" : "all",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(201,169,110,0.06),transparent_32%),radial-gradient(circle_at_75%_70%,rgba(201,169,110,0.04),transparent_34%)]" />

      <div
        className="relative flex w-[min(86vw,360px)] flex-col items-center rounded-[2rem] border border-[var(--lux-border-subtle)] bg-[var(--lux-surface-dark)] px-8 py-9 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        style={{
          transform: leaving ? "translateY(-8px) scale(0.98)" : "translateY(0) scale(1)",
          transition: "transform 0.5s ease",
        }}
      >
        <div className="relative mb-5 grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 rounded-full border border-[var(--lux-gold-primary)]/30 animate-ping [animation-duration:1.8s]" />
          <span className="absolute inset-2 rounded-full border border-[var(--lux-gold-primary)]/60 animate-spin [animation-duration:2.4s] border-t-transparent" />

          {logoUrl ? (
            <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-white/5 p-3 shadow-xl">
              <img
                src={logoUrl}
                alt={businessName}
                className="max-h-full max-w-full object-contain animate-pulse [animation-duration:1.8s]"
              />
            </div>
          ) : (
            <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-[var(--lux-bg-main)] text-[var(--lux-gold-primary)] shadow-xl border border-[var(--lux-border-subtle)]">
              <Palette size={36} />
            </div>
          )}
        </div>

        <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--lux-text-primary)]">
          {businessName}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-[var(--lux-text-secondary)]">{tagline}</p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[var(--lux-gold-muted)] via-[var(--lux-gold-primary)] to-[#dfc494] animate-[loader-slide_1.15s_ease-in-out_infinite]" />
        </div>
        <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--lux-text-muted)]">
          Preparing your experience
        </span>
      </div>

      <style>{`
        @keyframes loader-slide {
          0% { transform: translateX(-110%); }
          50% { transform: translateX(55%); }
          100% { transform: translateX(210%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-"] { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
