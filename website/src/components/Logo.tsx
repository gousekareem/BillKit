/* Original BillKit mark: a receipt tucked into a stitched pocket with a verification tick. © 2026 Shaik Gouse Kareem. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="64" height="64" rx="15" fill="#0F766E" />
      <path d="M21 9h22a3 3 0 0 1 3 3v30H18V12a3 3 0 0 1 3-3z" fill="#fff" />
      <rect x="23.5" y="15" width="17" height="3.2" rx="1.6" fill="#99F6E4" />
      <rect x="23.5" y="21.5" width="12" height="3.2" rx="1.6" fill="#99F6E4" />
      <rect x="23.5" y="28" width="17" height="3.2" rx="1.6" fill="#0F766E" opacity="0.55" />
      <path d="M11 33h42v12c0 6.1-4.9 11-11 11H22c-6.1 0-11-4.9-11-11V33z" fill="#134E4A" />
      <path d="M15 37.5h34" stroke="#99F6E4" strokeWidth="1.6" strokeDasharray="3 2.6" strokeLinecap="round" opacity="0.8" />
      <circle cx="45" cy="46" r="7.5" fill="#F59E0B" />
      <path d="M41.6 46.2l2.4 2.4 4.6-4.9" fill="none" stroke="#0B1F2A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      <span>
        Bill<span className="kit">Kit</span>
      </span>
    </span>
  );
}
