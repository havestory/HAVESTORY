import { useEffect, useState } from 'react';
import { useGetSettings } from '@workspace/api-client-react';
import { Printer } from 'lucide-react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { data: settings } = useGetSettings();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1800);
    const t2 = setTimeout(() => onDone(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary"
      style={{
        transition: 'opacity 0.6s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Subtle noise */}
      <div className="noise absolute inset-0 pointer-events-none" />

      {/* Logo mark */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center animate-fade-up" style={{ animationDelay: '0ms' }}>
          {settings?.logoUrl
            ? <img src={settings.logoUrl} alt="logo" className="w-10 h-10 object-contain" />
            : <Printer className="w-8 h-8 text-secondary" />}
        </div>

        <div className="text-center animate-fade-up" style={{ animationDelay: '120ms' }}>
          <h1 className="font-serif text-4xl font-bold text-primary-foreground tracking-tight">
            {settings?.businessName || 'HAVESTORY'}
          </h1>
          {settings?.taglineEnabled !== false && settings?.tagline && (
            <p className="text-primary-foreground/60 text-sm mt-1 tracking-widest font-light">
              {settings.tagline}
            </p>
          )}
        </div>

        {/* Minimal loading bar */}
        <div className="w-32 h-px bg-primary-foreground/20 rounded-full overflow-hidden animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div
            className="h-full bg-secondary rounded-full"
            style={{
              animation: 'splash-progress 1.6s cubic-bezier(0.22,1,0.36,1) both',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
