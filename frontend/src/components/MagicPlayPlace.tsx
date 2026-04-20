'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Star } from 'lucide-react';
import { Mode, NeurologicalProfile, AgeCohort, Modality, StimulusType } from '../lib/types';
import { buildErrorDiagnosticGuidance, useBackendDiagnostics } from '../hooks/useBackendDiagnostics';
import { useAlgorithmWorkflow } from '../hooks/useAlgorithmWorkflow';
import { ControlPanel } from './panels/ControlPanel';
import { CenterStatusVisualizer } from './visualizer/CenterStatusVisualizer';
import { OutputPanel } from './panels/OutputPanel';

export default function MagicPlayPlace() {
  const [mode, setMode] = useState<Mode>('discovery');
  const [profile, setProfile] = useState<NeurologicalProfile>('neurotypical');
  const [cohort, setCohort] = useState<AgeCohort>('adult');
  const [valence, setValence] = useState(50);
  const [arousal, setArousal] = useState(50);
  const [modality, setModality] = useState<Modality>('audio');
  const [stimulusType, setStimulusType] = useState<StimulusType>('text');
  const [textInput, setTextInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    if (stimulusType === 'text') return;
    fileInputRef.current?.click();
  };

  const {
    backendHealth,
    backendReachability,
    lastInferenceMode,
    lastRequestId,
    diagnosticGuidance: backendDiagnosticGuidance,
    refreshHealth,
    setLastRequestId,
    setLastInferenceMode,
  } = useBackendDiagnostics();

  const {
    isProcessing,
    progress,
    analysis,
    remarks,
    findings,
    lastGenerationMode,
    lastBackendError,
    sessionId,
    sessionTimestamp,
    handleRunAlgorithm,
  } = useAlgorithmWorkflow(refreshHealth, setLastRequestId, setLastInferenceMode);

  const diagnosticGuidance = useMemo(() => {
    const combined = backendDiagnosticGuidance.filter(
      (item) => item !== 'No active diagnostics warnings.'
    );
    for (const item of buildErrorDiagnosticGuidance(lastBackendError)) {
      if (!combined.includes(item)) {
        combined.push(item);
      }
    }
    return combined.length > 0 ? combined : ['No active diagnostics warnings.'];
  }, [backendDiagnosticGuidance, lastBackendError]);
  
  const handleExecute = () => {
    handleRunAlgorithm({
      mode,
      profile,
      cohort,
      stimulusType,
      textInput,
      mediaFile,
      valence,
      arousal,
      modality,
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-4">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-emerald-500" fill="currentColor" />
            <h1 className="text-xl tracking-[0.2em] uppercase">Magic Play Place</h1>
            <span className="ml-2 hidden sm:inline-block px-2 py-0.5 text-[10px] tracking-widest border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 rounded uppercase">
              {profile} • {cohort}
            </span>
          </div>
          <nav className="flex gap-1 flex-wrap">
            {(['discovery', 'therapeutics', 'conditioning'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-6 py-2 uppercase text-xs tracking-[0.15em] transition-all ${
                  mode === m
                    ? 'text-emerald-500 border-b-2 border-emerald-500'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {m === 'conditioning' ? 'Profile Config' : m}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-0 xl:h-[calc(100vh-73px)]">
        <div className="border-b xl:border-b-0 xl:border-r border-white/10 p-4 sm:p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="text-xs tracking-[0.15em] uppercase text-emerald-500 mb-6">Control Panel</div>

            <ControlPanel
              mode={mode}
              stimulusType={stimulusType}
              setStimulusType={setStimulusType}
              textInput={textInput}
              setTextInput={setTextInput}
              mediaFile={mediaFile}
              setMediaFile={setMediaFile}
              openFilePicker={openFilePicker}
              fileInputRef={fileInputRef}
              valence={valence}
              setValence={setValence}
              arousal={arousal}
              setArousal={setArousal}
              modality={modality}
              setModality={setModality}
              profile={profile}
              setProfile={setProfile}
              cohort={cohort}
              setCohort={setCohort}
            />

            <motion.button
              onClick={handleExecute}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-500 text-black uppercase tracking-[0.2em] text-sm font-bold relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group"
              whileHover={{ scale: isProcessing ? 1 : 1.02 }}
              whileTap={{ scale: isProcessing ? 1 : 0.98 }}
            >
              <motion.div
                className="absolute inset-0 bg-emerald-400"
                initial={{ x: '-100%' }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                {mode === 'conditioning'
                  ? 'Apply Profile'
                  : mode === 'therapeutics'
                  ? backendHealth?.generate_mode === 'model_loop'
                    ? 'Run Model Loop'
                    : 'Run Sim Loop'
                  : 'Run Algorithm'}
              </span>
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 sm:p-8 xl:p-12 relative border-b xl:border-b-0 border-white/10">
          <CenterStatusVisualizer profile={profile} isProcessing={isProcessing} progress={progress} />
        </div>

        <div className="xl:border-l border-white/10 p-4 sm:p-6 overflow-y-auto">
          <OutputPanel
            analysis={analysis}
            findings={findings}
            remarks={remarks}
            sessionId={sessionId}
            sessionTimestamp={sessionTimestamp}
            mode={mode}
            lastInferenceMode={lastInferenceMode}
            lastGenerationMode={lastGenerationMode}
            backendReachability={backendReachability}
            backendHealth={backendHealth}
            lastRequestId={lastRequestId}
            diagnosticGuidance={diagnosticGuidance}
            refreshHealth={refreshHealth}
          />
        </div>
      </div>
    </div>
  );
}
