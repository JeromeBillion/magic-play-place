'use client';

/**
 * The constellation motif, borrowed from the logo — it replaces the old
 * neural-net diagram as the app's centre of attention. A ringed orbit, one
 * bright four-point star and a scatter of smaller ones.
 */

/** Ratios lifted from the design's four-point star, so any size matches. */
const WAIST = 0.0865;
const SHOULDER = 0.327;

/** A four-point star of radius `r`, centred on the origin. */
export function starPath(r: number): string {
  const w = +(WAIST * r).toFixed(2);
  const s = +(SHOULDER * r).toFixed(2);
  return [
    `M0 ${-r}`,
    `C${w} ${-s} ${s} ${-w} ${r} 0`,
    `C${s} ${w} ${w} ${s} 0 ${r}`,
    `C${-w} ${s} ${-s} ${w} ${-r} 0`,
    `C${-s} ${-w} ${-w} ${-s} 0 ${-r}`,
    'Z',
  ].join(' ');
}

/** The small solid star used inline beside a line of text. */
export function StarGlyph({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z" />
    </svg>
  );
}

type ConstellationProps = {
  /** Twinkles while the model is thinking. */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function Constellation({ active = false, className, style }: ConstellationProps) {
  return (
    <svg
      viewBox="0 0 320 230"
      aria-hidden="true"
      className={`${active ? 'twinkle ' : ''}${className ?? ''}`}
      style={{ transformOrigin: 'center', ...style }}
    >
      <ellipse
        cx="160"
        cy="118"
        rx="140"
        ry="42"
        transform="rotate(-12 160 118)"
        fill="none"
        stroke="var(--color-sage-600)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d={starPath(52)} transform="translate(160 104)" fill="var(--color-sage-500)" />
      <path d={starPath(18)} transform="translate(84 42)" fill="var(--color-accent-400)" />
      <path d={starPath(13)} transform="translate(240 56)" fill="var(--color-sage-400)" />
      <path d={starPath(11)} transform="translate(236 172)" fill="var(--color-accent-300)" />
      <circle cx="96" cy="172" r="4" fill="var(--color-sage-400)" />
      <circle cx="52" cy="112" r="3.5" fill="var(--color-accent-300)" />
      <circle cx="272" cy="118" r="3.5" fill="var(--color-sage-300)" />
    </svg>
  );
}
