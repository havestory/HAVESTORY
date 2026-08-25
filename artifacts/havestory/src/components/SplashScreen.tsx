import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetSettings } from '@workspace/api-client-react';
import { Image as ImageIcon } from 'lucide-react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useGetSettings();
  const [fading, setFading] = useState(false);
  const [minimumDone, setMinimumDone] = useState(false);
  const completed = useRef(false);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setFading(true);
    window.setTimeout(onDone, 300);
  }, [onDone]);

  useEffect(() => {
    const minimumTimer = window.setTimeout(() => setMinimumDone(true), 420);
    const safetyTimer = window.setTimeout(finish, 1400);
    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [finish]);

  useEffect(() => {
    if (minimumDone && !settingsLoading) finish();
  }, [finish, minimumDone, settingsLoading]);

  return (
    <div
      className="hs-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        transition: 'opacity 0.6s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <div className="hs-splash-orb hs-splash-orb-one" />
      <div className="hs-splash-orb hs-splash-orb-two" />

      {/* Logo mark */}
      <div className="hs-splash-inner relative z-10 flex flex-col items-center">
        <div className="hs-splash-mark animate-fade-up" style={{ animationDelay: '0ms' }}>
          {!settingsLoading && settings?.logoUrl
            ? <img src={settings.logoUrl} alt="" />
            : <><span>HS</span><ImageIcon /></>}
        </div>

        <div className="hs-splash-copy text-center animate-fade-up" style={{ animationDelay: '120ms' }}>
          <small>COLOUR LAB · FRAME STUDIO</small>
          <h1>
            {settingsLoading ? 'HAVESTORY' : settings?.businessName || 'HAVESTORY'}
          </h1>
          <p>
            {settingsLoading
              ? ' '
              : settings?.taglineEnabled !== false && settings?.tagline
                ? settings.tagline
                : 'A considered collection of frames and stories'}
          </p>
        </div>

        <div className="hs-splash-progress animate-fade-up" style={{ animationDelay: '240ms' }}><i /></div>
        <p className="hs-splash-status">{settingsError ? 'Opening the studio' : settingsLoading ? 'Setting the scene' : 'Welcome to the studio'}</p>
      </div>
    </div>
  );
}
