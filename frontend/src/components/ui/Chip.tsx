'use client';

/**
 * The pill choice control. Rendered as a radio group so keyboard and screen
 * reader users get real single-choice semantics, not a row of buttons.
 */
export function ChipGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex flex-wrap gap-2 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function Chip({
  selected,
  onSelect,
  label,
  hint,
  ariaLabel,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  /** Quiet trailing text, e.g. "the standard baseline". */
  hint?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={`chip${selected ? ' chip-selected' : ''}${className ? ` ${className}` : ''}`}
    >
      <span>{label}</span>
      {hint ? <span className="text-[11px] opacity-65">· {hint}</span> : null}
    </button>
  );
}
