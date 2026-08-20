import { useEffect, useRef, useState } from 'react';
import { useGetSettings, useGetNotices, useListPortfolio, useListProducts, useListReviews, useListServices } from '@workspace/api-client-react';
import { Image as ImageIcon } from 'lucide-react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useGetSettings();
  const { isLoading: productsLoading } = useListProducts();
  const { isLoading: servicesLoading } = useListServices();
  const { isLoading: portfolioLoading } = useListPortfolio();
  const { isLoading: reviewsLoading } = useListReviews();
  const { isLoading: noticesLoading } = useGetNotices();
  const isLoading = settingsLoading || productsLoading || servicesLoading || portfolioLoading || reviewsLoading || noticesLoading;
  const isError = settingsError;
  const [fading, setFading] = useState(false);
  const [minimumDone, setMinimumDone] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    const minimumTimer = setTimeout(() => setMinimumDone(true), 850);
    const maximumTimer = setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      setFading(true);
      setTimeout(onDone, 480);
    }, 5500);
    return () => { clearTimeout(minimumTimer); clearTimeout(maximumTimer); };
  }, [onDone]);

  useEffect(() => {
    if (!minimumDone || isLoading || completed.current) return;
    completed.current = true;
    setFading(true);
    const timer = setTimeout(onDone, 480);
    return () => clearTimeout(timer);
  }, [minimumDone, isLoading, isError, onDone]);

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
          {settings?.logoUrl
            ? <img src={settings.logoUrl} alt="" />
            : <><span>HS</span><ImageIcon /></>}
        </div>

        <div className="hs-splash-copy text-center animate-fade-up" style={{ animationDelay: '120ms' }}>
          <small>COLOUR LAB · FRAME STUDIO</small>
          <h1>
            {settings?.businessName || 'HAVESTORY'}
          </h1>
          {settings?.taglineEnabled !== false && settings?.tagline && (
            <p>
              {settings.tagline}
            </p>
          )}
        </div>

        <div className="hs-splash-progress animate-fade-up" style={{ animationDelay: '240ms' }}><i /></div>
        <p className="hs-splash-status">{isError ? 'Opening the studio' : isLoading ? 'Preparing your experience' : 'Welcome to the studio'}</p>
      </div>
    </div>
  );
}
