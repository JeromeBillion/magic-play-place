import { RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { Mode, StimulusType, Modality, NeurologicalProfile, AgeCohort } from '../../lib/types';
import { getAcceptForStimulus } from '../../lib/api';

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
    <AnimatePresence mode="wait">
      {mode === 'discovery' && (
        <motion.div
          key="discovery"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-3">
              Stimulus Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['text', 'image', 'video', 'audio'] as StimulusType[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStimulusType(s);
                    if (s === 'text') setMediaFile(null);
                  }}
                  className={`py-3 text-xs uppercase tracking-wide border transition-all ${
                    stimulusType === s
                      ? 'border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border-white/20 text-white/60 hover:border-white/40'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {stimulusType === 'text' ? (
            <div>
              <label className="text-xs tracking-wide uppercase text-white/60 block mb-2">
                Text Input
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full h-36 bg-black border border-white/20 focus:border-emerald-500 outline-none p-3 text-sm resize-none transition-colors"
                placeholder="Enter stimulus description..."
              />
            </div>
          ) : (
            <div className="group">
              <label className="text-xs tracking-wide uppercase text-white/60 block mb-2">
                {stimulusType} Upload
              </label>
              <button
                type="button"
                onClick={openFilePicker}
                className="w-full border border-dashed border-white/20 group-hover:border-emerald-500/50 p-8 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer bg-transparent"
              >
                <Upload className="w-5 h-5 text-white/40 group-hover:text-emerald-500/70" />
                <span className="text-xs text-white/40">
                  {mediaFile ? mediaFile.name : `Select ${stimulusType} file`}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={getAcceptForStimulus(stimulusType)}
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </motion.div>
      )}

      {mode === 'therapeutics' && (
        <motion.div
          key="therapeutics"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-4">
              Valence: {valence}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={valence}
              onChange={(e) => setValence(Number(e.target.value))}
              className="w-full h-1 bg-white/10 appearance-none cursor-pointer slider-emerald"
            />
          </div>

          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-4">
              Arousal: {arousal}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={arousal}
              onChange={(e) => setArousal(Number(e.target.value))}
              className="w-full h-1 bg-white/10 appearance-none cursor-pointer slider-emerald"
            />
          </div>

          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-3">
              Output Modality
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['audio', 'text', 'image', 'video'] as Modality[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModality(m)}
                  className={`py-3 text-xs uppercase tracking-wide border transition-all ${
                    modality === m
                      ? 'border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border-white/20 text-white/60 hover:border-white/40'
                  }`}
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
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-3">
              Neurological Profile
            </label>
            <div className="space-y-2">
              {(['neurotypical', 'adhd', 'asd'] as NeurologicalProfile[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProfile(p)}
                  className={`w-full py-3 text-xs uppercase tracking-wide border transition-all ${
                    profile === p
                      ? 'border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border-white/20 text-white/60 hover:border-white/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs tracking-wide uppercase text-white/60 block mb-3">
              Age Cohort
            </label>
            <div className="space-y-2">
              {(['youth', 'adult', 'elderly'] as AgeCohort[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCohort(c)}
                  className={`w-full py-3 text-xs uppercase tracking-wide border transition-all ${
                    cohort === c
                      ? 'border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border-white/20 text-white/60 hover:border-white/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
