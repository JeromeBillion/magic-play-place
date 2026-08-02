'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

import { useBackendDiagnostics } from '../hooks/useBackendDiagnostics';
import { useAlgorithmWorkflow } from '../hooks/useAlgorithmWorkflow';
import { ControlPanel } from './panels/ControlPanel';
import { OutputPanel } from './panels/OutputPanel';
import { CenterStatusVisualizer } from './visualizer/CenterStatusVisualizer';
import { Tag } from './ui/Tag';
import {
  COHORT_LABELS,
  MODES,
  MODE_LABELS,
  PROFILE_LABELS,
  RUNNING_LABEL,
  RUN_LABELS,
} from '../lib/copy';

import type {
  Mode,
  StimulusType,
  Modality,
  NeurologicalProfile,
  AgeCohort,
} from '../lib/types';

export default function MagicPlayPlace() {
  // ─── UI State ───
  const [mode, setMode] = useState<Mode>('discovery');
  const [profile, setProfile] = useState<NeurologicalProfile>('neurotypical');
  const [cohort, setCohort] = useState<AgeCohort>('adult');
  const [valence, setValence] = useState(60);
  const [arousal, setArousal] = useState(35);
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
    status,
    errorKind,
    isProcessing,
    resultTitle,
    analysis,
    remarks,
    findings,
    lastGenerationMode,
    lastBackendError,
    isMockResult,
    runHistory,
    sessionId,
    sessionTimestamp,
    handleRunAlgorithm,
    exportHistory,
  } = useAlgorithmWorkflow(refreshHealth, setLastRequestId, setLastInferenceMode);

  const diagnosticGuidance = buildGuidance(lastBackendError);

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

  const runLabel = isProcessing ? RUNNING_LABEL : RUN_LABELS[mode];

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-ink">
      {/* ─── Header ─── */}
      <header className="flex flex-wrap items-center gap-4 border-b px-7 py-4">
        <Image
          src="/magic-play-place-logo-black.png"
          alt=""
          width={34}
          height={34}
          className="h-auto w-[34px]"
          priority
        />
        <span className="font-[family-name:var(--font-heading)] text-[19px]">
          Magic Play Place
        </span>
        <Tag tone="tag-accent-2">research, gently</Tag>

        <nav
          className="ml-auto inline-flex gap-1 rounded-full border p-1"
          role="tablist"
          aria-label="Mode"
        >
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              role="tab"
              aria-selected={mode === m}
              aria-label={`Switch to ${m} mode`}
              data-mode={m}
              className={`mode-pill${mode === m ? ' mode-pill-active' : ''}`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </nav>
      </header>

      {/* ─── Main Grid ─── */}
      <div className="grid gap-7 px-7 py-7 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_400px]">
        {/* ─── Left: Controls ─── */}
        <div className="flex flex-col gap-5 self-start rounded-[32px] bg-surface p-6">
          <div>
            <h4 className="mb-2">Set up a run</h4>
          </div>

          <ControlPanel
            mode={mode}
            stimulusType={stimulusType}
            setStimulusType={setStimulusType}
            textInput={textInput}
            setTextInput={setTextInput}
            mediaFile={mediaFile}
            setMediaFile={setMediaFile}
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
          <p className="text-muted flex items-center gap-2 text-[12px]">
            <span
              className="size-2 rounded-full bg-sage-500"
              aria-hidden="true"
            />
            modelling for {PROFILE_LABELS[profile]} · {COHORT_LABELS[cohort]}
          </p>

          <button
            type="button"
            onClick={onRun}
            disabled={isProcessing}
            className="btn btn-primary btn-run"
            id="run-algorithm-btn"
          >
            <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {runLabel}
          </button>
        </div>

        {/* ─── Centre: Visualiser ─── */}
        <div className="flex items-center justify-center">
          <CenterStatusVisualizer
            profile={profile}
            cohort={cohort}
            status={status}
            errorKind={errorKind}
            backendReachability={backendReachability}
          />
        </div>

        {/* ─── Right: Output ─── */}
        <div className="self-start lg:col-span-2 xl:col-span-1">
          <OutputPanel
            status={status}
            errorKind={errorKind}
            resultTitle={resultTitle}
            analysis={analysis}
            remarks={remarks}
            findings={findings}
            isMockResult={isMockResult}
            onRetry={onRun}
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
            runHistory={runHistory}
            exportHistory={exportHistory}
          />
        </div>
      </div>
    </div>
  );
}
