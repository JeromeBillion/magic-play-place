'use client';

import { RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, HelpCircle } from 'lucide-react';
import { Mode, StimulusType, Modality, NeurologicalProfile, AgeCohort } from '../../lib/types';
import { getAcceptForStimulus } from '../../lib/api';

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  discovery: 'Submit multimodal stimuli to predict fMRI neural-response patterns with evidence-tagged analysis.',
  therapeutics: 'Configure target emotional state vectors and generate optimized intervention simulations.',
  conditioning: 'Set the demographic profile baseline for all future prediction and generation runs.',
};

const PROFILE_DESCRIPTIONS: Record<NeurologicalProfile, string> = {
  neurotypical: 'Standard baseline profile',
  adhd: 'Attention-divergent profile',
  asd: 'Autism spectrum profile',
};

type ControlPanelProps = {
  mode: Mode;
  stimulusType: StimulusType;
  setStimulusType: (s: StimulusType) => void;
  textInput: string;
  setTextInput: (s: string) => void;
  mediaFile: File | null;
  setMediaFile: (f: File | null) => void;
  openFilePicker: () => void;
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
  openFilePicker,
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
    <div className="space-y-5">
      {/* Mode description */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-white/40 leading-relaxed"
      >
        {MODE_DESCRIPTIONS[mode]}
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === 'discovery' && (
          <motion.div
            key="discovery"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <label className="section-label" id="stimulus-label">Stimulus Type</label>
                <HelpCircle className="w-3 h-3 text-white/20" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="stimulus-label">
                {(['text', 'image', 'video', 'audio'] as StimulusType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setStimulusType(s);
                      if (s === 'text') setMediaFile(null);
                    }}
                    role="radio"
                    aria-checked={stimulusType === s}
                    aria-label={`Stimulus type: ${s}`}
                    className={`ctrl-btn ${stimulusType === s ? 'selected' : ''}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {stimulusType === 'text' ? (
              <div>
                <label className="section-label block mb-2" htmlFor="text-input">Text Input</label>
                <textarea
                  id="text-input"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="text-input h-32"
                  placeholder="Describe a stimulus to predict neural response patterns..."
                  aria-label="Stimulus text input"
                />
              </div>
            ) : (
              <div>
                <label className="section-label block mb-2">{stimulusType} Upload</label>
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="upload-area w-full"
                  aria-label={`Upload ${stimulusType} file`}
                >
                  <Upload className="w-5 h-5 text-white/30" />
                  <span className="text-xs text-white/35">
                    {mediaFile ? mediaFile.name : `Select ${stimulusType} file`}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={getAcceptForStimulus(stimulusType)}
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                  aria-hidden="true"
                />
              </div>
            )}
          </motion.div>
        )}

        {mode === 'therapeutics' && (
          <motion.div
            key="therapeutics"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="section-label" htmlFor="valence-slider">Valence</label>
                <span className="text-xs font-semibold" style={{ color: 'var(--therapeutics)' }}>
                  {valence}%
                </span>
              </div>
              <input
                id="valence-slider"
                type="range"
                min="0"
                max="100"
                value={valence}
                onChange={(e) => setValence(Number(e.target.value))}
                className="slider-premium"
                aria-label={`Valence: ${valence}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={valence}
              />
              <div className="flex justify-between text-[9px] text-white/25 mt-1 uppercase tracking-wider">
                <span>Negative</span>
                <span>Positive</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="section-label" htmlFor="arousal-slider">Arousal</label>
                <span className="text-xs font-semibold" style={{ color: 'var(--therapeutics)' }}>
                  {arousal}%
                </span>
              </div>
              <input
                id="arousal-slider"
                type="range"
                min="0"
                max="100"
                value={arousal}
                onChange={(e) => setArousal(Number(e.target.value))}
                className="slider-premium"
                aria-label={`Arousal: ${arousal}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={arousal}
              />
              <div className="flex justify-between text-[9px] text-white/25 mt-1 uppercase tracking-wider">
                <span>Calm</span>
                <span>Excited</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <label className="section-label" id="modality-label">Output Modality</label>
                <HelpCircle className="w-3 h-3 text-white/20" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="modality-label">
                {(['audio', 'text', 'image', 'video'] as Modality[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModality(m)}
                    role="radio"
                    aria-checked={modality === m}
                    aria-label={`Output modality: ${m}`}
                    className={`ctrl-btn ${modality === m ? 'selected' : ''}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'conditioning' && (
          <motion.div
            key="conditioning"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <label className="section-label" id="profile-label">Neurological Profile</label>
                <HelpCircle className="w-3 h-3 text-white/20" aria-hidden="true" />
              </div>
              <div className="space-y-2" role="radiogroup" aria-labelledby="profile-label">
                {(['neurotypical', 'adhd', 'asd'] as NeurologicalProfile[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfile(p)}
                    role="radio"
                    aria-checked={profile === p}
                    aria-label={`${PROFILE_DESCRIPTIONS[p]}`}
                    className={`w-full ctrl-btn text-left flex items-center justify-between ${profile === p ? 'selected' : ''}`}
                  >
                    <span>{p}</span>
                    <span className="text-[9px] text-white/25 normal-case tracking-normal">
                      {PROFILE_DESCRIPTIONS[p]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="section-label block mb-3" id="cohort-label">Age Cohort</label>
              <div className="space-y-2" role="radiogroup" aria-labelledby="cohort-label">
                {(['youth', 'adult', 'elderly'] as AgeCohort[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCohort(c)}
                    role="radio"
                    aria-checked={cohort === c}
                    aria-label={`Age cohort: ${c}`}
                    className={`w-full ctrl-btn ${cohort === c ? 'selected' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
