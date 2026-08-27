import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetSettings } from '@workspace/api-client-react';
import { StudioLoader } from './StudioLoader';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
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
      className="hs-studio-loader-overlay fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        transition: 'opacity 0.6s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <StudioLoader label="Preparing your studio collection" logoUrl={settings?.logoUrl} />
    </div>
  );
}
