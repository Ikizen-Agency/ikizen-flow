/** Ikizen Flow mark: indigo rounded tile with a stylised "flow" bracket. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#4338ca" />
      <path d="M10 10h12v4h-8v4h8v4H10z" fill="#ffffff" />
      <rect x="18" y="14" width="4" height="4" fill="#4338ca" />
    </svg>
  );
}
