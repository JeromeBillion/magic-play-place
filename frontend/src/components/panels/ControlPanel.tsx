'use client';

import { RefObject } from 'react';

import { StimulusChoices, StimulusInput } from '../controls/StimulusPicker';
import { FeelingSliders, ModalityChoices } from '../controls/FeelingPicker';
import { CohortChoices, ProfileChoices } from '../controls/ProfilePicker';
import { MODE_DESCRIPTIONS } from '../../lib/copy';
import type {
  AgeCohort,
  Mode,
  Modality,
  NeurologicalProfile,
  StimulusType,
} from '../../lib/types';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[12px] font-semibold">{label}</p>
      {children}
    </div>
  );
}

type ControlPanelProps = {
  mode: Mode;
  stimulusType: StimulusType;
  setStimulusType: (s: StimulusType) => void;
  textInput: string;
  setTextInput: (s: string) => void;
  mediaFile: File | null;
  setMediaFile: (f: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  valence: number;
  setValence: (v: number) => void;
  arousal: number;
  setArousal: (a: number) => void;
  modality: Modality;
  setModality: (m: Modality) => void;
  profile: NeurologicalProfile;
  setProfile: (p: NeurologicalProfile) => void;
  cohort: AgeCohort;
  setCohort: (c: AgeCohort) => void;
};

export function ControlPanel({
  mode,
  stimulusType,
  setStimulusType,
  textInput,
  setTextInput,
  mediaFile,
  setMediaFile,
  fileInputRef,
  valence,
  setValence,
  arousal,
  setArousal,
  modality,
  setModality,
  profile,
  setProfile,
  cohort,
  setCohort,
}: ControlPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-[13px]">{MODE_DESCRIPTIONS[mode]}</p>

      {mode === 'discovery' ? (
        <div className="flex flex-col gap-4">
          <Group label="What should we show it?">
            <StimulusChoices
              stimulusType={stimulusType}
              setStimulusType={setStimulusType}
              setMediaFile={setMediaFile}
            />
          </Group>
          <StimulusInput
            stimulusType={stimulusType}
            textInput={textInput}
            setTextInput={setTextInput}
            mediaFile={mediaFile}
            setMediaFile={setMediaFile}
            fileInputRef={fileInputRef}
          />
        </div>
      ) : null}

      {mode === 'therapeutics' ? (
        <div className="flex flex-col gap-5">
          <FeelingSliders
            valence={valence}
            setValence={setValence}
            arousal={arousal}
            setArousal={setArousal}
          />
          <Group label="Deliver it as">
            <ModalityChoices modality={modality} setModality={setModality} />
          </Group>
        </div>
      ) : null}

      {mode === 'conditioning' ? (
        <div className="flex flex-col gap-4">
          <Group label="Who are we modelling?">
            <ProfileChoices profile={profile} setProfile={setProfile} />
          </Group>
          <Group label="Their age">
            <CohortChoices cohort={cohort} setCohort={setCohort} />
          </Group>
        </div>
      ) : null}
    </div>
  );
}
