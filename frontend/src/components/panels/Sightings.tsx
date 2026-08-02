'use client';

import { EvidenceTag, Tag } from '../ui/Tag';
import { StarGlyph } from '../ui/Constellation';
import { EVIDENCE_LEGEND, MOCK_NOTICE } from '../../lib/copy';
import type { Finding } from '../../lib/types';

/** What the app is watching for before anything has been run. */
export const WAITING_FOR = ['Pathway correlations', 'Receptor activity', 'Cortex engagement'];

function Dot({ tone }: { tone: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: tone }}
      aria-hidden="true"
    />
  );
}

export function MockNotice() {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-[16px] bg-accent-200 px-4 py-2 text-[12px] text-accent-900">
      <StarGlyph size={14} />
      <span>{MOCK_NOTICE}</span>
    </div>
  );
}

/** The four honesty labels, shown while there is nothing to label yet. */
export function TrustLegend() {
  return (
    <div>
      <p className="text-muted mt-4 text-[11px]">How much to trust each finding:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {EVIDENCE_LEGEND.map((e) => (
          <Tag key={e.label} tone={e.tone}>
            {e.label}
          </Tag>
        ))}
      </div>
    </div>
  );
}

/** One row per finding, each carrying its own trust label. */
export function FindingRows({ findings }: { findings: Finding[] }) {
  return (
    <ul className="flex flex-col gap-3 text-[13px]">
      {findings.map((f, i) => (
        <li key={`${f.text}-${i}`} className="flex items-center gap-3">
          <Dot tone="var(--color-sage-600)" />
          <span className="flex-1">{f.text}</span>
          <EvidenceTag tag={f.tag} />
        </li>
      ))}
    </ul>
  );
}

/** The placeholder rows shown before the first run. */
export function WaitingRows({ listening }: { listening: boolean }) {
  return (
    <ul className="flex flex-col gap-3 text-[13px]">
      {WAITING_FOR.map((label) => (
        <li key={label} className="flex items-center gap-3">
          <Dot tone="var(--color-sage-400)" />
          <span className="flex-1">{label}</span>
          <span className="text-muted text-[11px]">{listening ? 'listening' : 'waiting'}</span>
        </li>
      ))}
    </ul>
  );
}
