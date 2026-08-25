export function StudioLoader({ label = 'Preparing your studio experience' }: { label?: string }) {
  return (
    <div className="hs-studio-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="hs-studio-loader-rings" aria-hidden="true">
        <span className="hs-studio-loader-ring hs-studio-loader-ring-one" />
        <span className="hs-studio-loader-ring hs-studio-loader-ring-two" />
        <span className="hs-studio-loader-ring hs-studio-loader-ring-three" />
        <span className="hs-studio-loader-core">HS</span>
      </div>
      <div className="hs-studio-loader-brand">HAVESTORY</div>
    </div>
  );
}
