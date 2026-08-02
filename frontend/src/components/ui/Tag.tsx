'use client';

import { evidenceLabel, type TagTone } from '../../lib/copy';

export function Tag({
  tone = 'tag-neutral',
  children,
  className,
}: {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`tag ${tone}${className ? ` ${className}` : ''}`}>{children}</span>;
}

/** Renders a backend evidence tag in the app's plain-spoken wording. */
export function EvidenceTag({ tag }: { tag: string }) {
  const { label, tone } = evidenceLabel(tag);
  return (
    <Tag tone={tone}>
      <span className="sr-only">how much to trust this: </span>
      {label}
    </Tag>
  );
}
