'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';

import { useBackendDiagnostics } from '../hooks/useBackendDiagnostics';
import { useAlgorithmWorkflow } from '../hooks/useAlgorithmWorkflow';
import { ControlPanel } from './panels/ControlPanel';
import { OutputPanel } from './panels/OutputPanel';
import { CenterStatusVisualizer } from './visualizer/CenterStatusVisualizer';

import type { Mode, StimulusType, Modality, NeurologicalProfile, AgeCohort } from '../lib/types';

export default function MagicPlayPlace() {
  // ─── UI State ───
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

  // ─── Backend Diagnostics Hook ───
  const {
    backendHealth,
    backendReachability,
    lastInferenceMode,
    lastRequestId,
    refreshHealth,
    setLastRequestId,
    setLastInferenceMode,
    buildGuidance,
  } = useBackendDiagnostics();

  // ─── Algorithm Workflow Hook ───
  const {
    isProcessing,
    analysis,
    remarks,
    findings,
    lastGenerationMode,
    lastBackendError,
    isMockResult,
    evidenceTags,
    runHistory,
    sessionId,
    sessionTimestamp,
    handleRunAlgorithm,
    exportHistory,
  } = useAlgorithmWorkflow(refreshHealth, setLastRequestId, setLastInferenceMode);

  const diagnosticGuidance = buildGuidance(lastBackendError);

  const openFilePicker = () => {
    if (stimulusType === 'text') return;
    fileInputRef.current?.click();
  };

  const onRun = () => {
    void handleRunAlgorithm({
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

  const getRunLabel = () => {
    if (mode === 'conditioning') return 'Apply Profile';
    if (mode === 'therapeutics') {
      return backendHealth?.generate_mode === 'model_loop' ? 'Run Model Loop' : 'Run Simulation';
    }
    return 'Run Discovery';
  };

  return (
    <div className="min-h-screen mesh-bg text-white overflow-x-hidden">
      {/* ─── Header ─── */}
      <header className="glass-panel border-t-0 border-x-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h1 className="text-base font-semibold tracking-[0.25em] uppercase">
              Magic Play Place
            </h1>
            <span className="text-[9px] tracking-widest text-white/25 uppercase hidden sm:inline">
              Neuro-AI Lab
            </span>
          </div>
          <nav className="flex gap-0.5" role="tablist" aria-label="Mode navigation">
            {(['discovery', 'therapeutics', 'conditioning'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                role="tab"
                aria-selected={mode === m}
                aria-label={`Switch to ${m} mode`}
                data-mode={m}
                className={`mode-btn ${mode === m ? 'active' : ''}`}
              >
                {m}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ─── Main Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_360px] gap-0 lg:h-[calc(100vh-57px)]">
        {/* ─── Left: Controls ─── */}
        <div className="border-b lg:border-b-0 lg:border-r border-white/[0.06] p-5 sm:p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="section-label accent">Control Panel</div>

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

            {/* Active Profile Badge */}
            <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              {profile} / {cohort}
            </div>

            {/* Run Button */}
            <motion.button
              onClick={onRun}
              disabled={isProcessing}
              className="run-btn"
              whileHover={{ scale: isProcessing ? 1 : 1.015 }}
              whileTap={{ scale: isProcessing ? 1 : 0.985 }}
              aria-label={getRunLabel()}
              id="run-algorithm-btn"
            >
              <span className="relative flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                {getRunLabel()}
              </span>
            </motion.button>
          </div>
        </div>

        {/* ─── Center: Visualizer ─── */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-10 relative border-b lg:border-b-0 border-white/[0.06]">
          <CenterStatusVisualizer
            profile={profile}
            isProcessing={isProcessing}
            mode={mode}
            backendReachability={backendReachability}
          />
        </div>

        {/* ─── Right: Output ─── */}
        <div className="lg:border-l border-white/[0.06] p-4 sm:p-5 overflow-y-auto">
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
            refreshHealth={() => void refreshHealth()}
            isMockResult={isMockResult}
            evidenceTags={evidenceTags}
            runHistory={runHistory}
            exportHistory={exportHistory}
          />
        </div>
      </div>
    </div>
  );
}
