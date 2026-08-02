'use client';

import { useState, type DragEvent, type RefObject } from 'react';
import { Upload } from 'lucide-react';

import { Chip, ChipGroup } from '../ui/Chip';
import { STIMULUS_LABELS, STIMULUS_TYPES } from '../../lib/copy';
import { getAcceptForStimulus } from '../../lib/api';
import type { StimulusType } from '../../lib/types';

type Props = {
  stimulusType: StimulusType;
  setStimulusType: (s: StimulusType) => void;
  textInput: string;
  setTextInput: (s: string) => void;
  mediaFile: File | null;
  setMediaFile: (f: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
};

/** Step one of Explore: what are we showing the model? */
export function StimulusChoices({
  stimulusType,
  setStimulusType,
  setMediaFile,
}: Pick<Props, 'stimulusType' | 'setStimulusType' | 'setMediaFile'>) {
  return (
    <ChipGroup label="What should we show it?">
      {STIMULUS_TYPES.map((s) => (
        <Chip
          key={s}
          selected={stimulusType === s}
          onSelect={() => {
            setStimulusType(s);
            // Swapping away from a file type drops the file it was holding.
            setMediaFile(null);
          }}
          label={STIMULUS_LABELS[s]}
          ariaLabel={`Stimulus type: ${s}`}
        />
      ))}
    </ChipGroup>
  );
}

/** Step two: the words themselves, or the file. */
export function StimulusInput({
  stimulusType,
  textInput,
  setTextInput,
  mediaFile,
  setMediaFile,
  fileInputRef,
}: Omit<Props, 'setStimulusType'>) {
  const [isOver, setIsOver] = useState(false);

  if (stimulusType === 'text') {
    return (
      <div className="field">
        <label className="sr-only" htmlFor="text-input">
          Describe the stimulus
        </label>
        <textarea
          id="text-input"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          className="input"
          placeholder="Describe something — 'a calm forest at dawn'…"
        />
      </div>
    );
  }

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setMediaFile(dropped);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={`dropzone${isOver ? ' dropzone-over' : ''}`}
        aria-label={`Upload ${stimulusType} file`}
      >
        <Upload size={20} strokeWidth={2.75} aria-hidden="true" />
        <span className="text-[13px]">
          {mediaFile ? mediaFile.name : 'Drop your file here, or browse'}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={getAcceptForStimulus(stimulusType)}
        onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
        tabIndex={-1}
      />
    </div>
  );
}
