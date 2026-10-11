export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-display font-bold tracking-tight" style={{ fontSize: size }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#d6f85a" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#14213d" strokeWidth="3" />
        <circle cx="16" cy="16" r="2.5" fill="#14213d" />
      </svg>
      IronPlate
    </span>
  );
}
