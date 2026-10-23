export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      role="img"
    >
      <ellipse
        cx="256"
        cy="256"
        rx="158"
        ry="58"
        transform="rotate(-24 256 256)"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.72"
      />
      <circle cx="256" cy="256" r="92" fill="currentColor" />
      <circle cx="400" cy="298" r="15" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
