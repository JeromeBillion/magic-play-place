'use client';

import { Chip, ChipGroup } from '../ui/Chip';
import { Tag } from '../ui/Tag';
import { MODALITIES, MODALITY_LABELS } from '../../lib/copy';
import type { Modality } from '../../lib/types';

function Slider({
  id,
  label,
  value,
  onChange,
  low,
  high,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[12px] font-semibold" htmlFor={id}>
          {label}
        </label>
        <Tag tone="tag-accent-2">{value}</Tag>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
        aria-label={`${label}: ${value}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
      <div className="text-muted mt-1 flex justify-between text-[11px]">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Shape: aim for a feeling, then choose how it should be delivered. */
export function FeelingSliders({
  valence,
  setValence,
  arousal,
  setArousal,
}: {
  valence: number;
  setValence: (v: number) => void;
  arousal: number;
  setArousal: (a: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Slider
        id="valence-slider"
        label="Mood"
        value={valence}
        onChange={setValence}
        low="low"
        high="bright"
      />
      <Slider
        id="arousal-slider"
        label="Energy"
        value={arousal}
        onChange={setArousal}
        low="calm"
        high="excited"
      />
    </div>
  );
}

export function ModalityChoices({
  modality,
  setModality,
}: {
  modality: Modality;
  setModality: (m: Modality) => void;
}) {
  return (
    <ChipGroup label="Deliver it as">
      {MODALITIES.map((m) => (
        <Chip
          key={m}
          selected={modality === m}
          onSelect={() => setModality(m)}
          label={MODALITY_LABELS[m]}
          ariaLabel={`Output modality: ${m}`}
        />
      ))}
    </ChipGroup>
  );
}
