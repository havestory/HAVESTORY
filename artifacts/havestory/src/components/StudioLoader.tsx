/**
 * HAVESTORY "Developing Frame" loader.
 *
 * Concept: a photo frame draws itself (stroke animation), then the picture
 * inside "develops" — fading in from a soft blur like a print in the
 * darkroom — while the wordmark letters rise one by one. Unmistakably
 * HAVESTORY: the product is the loading metaphor.
 *
 * - Pure CSS/SVG, no JS animation loop.
 * - Respects prefers-reduced-motion (static final state).
 * - Never blocks: parents must time-box it (SplashScreen safety timers,
 *   boot overlay max timeout).
 */
export function StudioLoader({ label = 'Preparing your studio experience', logoUrl }: { label?: string; logoUrl?: string | null }) {
  const word = 'HAVESTORY';
  return (
    <div className="hs-studio-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="hs-dev-frame" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="hs-dev-svg">
          <defs>
            <linearGradient id="hs-dev-photo-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f3e6c8" />
              <stop offset="0.55" stopColor="#e3c88f" />
              <stop offset="1" stopColor="#b8894a" />
            </linearGradient>
            <clipPath id="hs-dev-clip">
              <rect x="30" y="30" width="60" height="60" rx="2" />
            </clipPath>
          </defs>
          {/* corner registration marks */}
          <g className="hs-dev-corners" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 26 V14 H26" />
            <path d="M94 14 H106 V26" />
            <path d="M14 94 V106 H26" />
            <path d="M94 106 H106 V94" />
          </g>
          {/* the frame draws itself */}
          <rect
            x="20" y="20" width="80" height="80" rx="5"
            className="hs-dev-rect"
            pathLength={1}
          />
          {/* the photograph develops inside */}
          <g clipPath="url(#hs-dev-clip)">
            {logoUrl ? (
              <image href={logoUrl} x="30" y="30" width="60" height="60" preserveAspectRatio="xMidYMid slice" className="hs-dev-photo" />
            ) : (
              <rect x="30" y="30" width="60" height="60" fill="url(#hs-dev-photo-grad)" className="hs-dev-photo" />
            )}
            <rect x="30" y="30" width="60" height="60" fill="#ffffff" className="hs-dev-wash" />
          </g>
        </svg>
      </div>
      <span className="hs-dev-word" aria-hidden="true">
        {word.split('').map((letter, index) => (
          <span key={index} style={{ animationDelay: `${0.55 + index * 0.045}s` }}>{letter}</span>
        ))}
      </span>
      <span className="hs-dev-bar" aria-hidden="true"><i /></span>
    </div>
  );
}
