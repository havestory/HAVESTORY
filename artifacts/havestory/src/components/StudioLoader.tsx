export function StudioLoader({ label = 'Preparing your studio experience', logoUrl }: { label?: string; logoUrl?: string | null }) {
  return (
    <div className="hs-studio-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="hs-studio-loader-mark" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : 'HS'}</div>
      <span className="hs-studio-loader-name" aria-hidden="true">HAVESTORY</span>
      <span className="hs-studio-loader-progress" aria-hidden="true"><i /></span>
    </div>
  );
}
