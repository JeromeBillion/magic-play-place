'use client';

import { StarGlyph } from '../ui/Constellation';
import { DISCLAIMER } from '../../lib/copy';
import {
  FindingRows,
  MockNotice,
  TrustLegend,
  WaitingRows,
} from './Sightings';
import { UnderTheHood } from './UnderTheHood';
import type {
  BackendHealthResponse,
  BackendReachability,
  Finding,
  GenerationMode,
  InferenceMode,
  Mode,
  RunResult,
  RunStatus,
} from '../../lib/types';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-surface px-6 py-5">
      <h5 className="mb-3">{title}</h5>
      {children}
    </section>
  );
}

type OutputPanelProps = {
  status: RunStatus;
  errorKind: 'validation' | 'backend';
  resultTitle: string;
  analysis: string;
  remarks: string;
  findings: Finding[];
  isMockResult: boolean;
  onRetry: () => void;
  sessionId: string;
  sessionTimestamp: string;
  mode: Mode;
  lastInferenceMode: InferenceMode;
  lastGenerationMode: GenerationMode;
  backendReachability: BackendReachability;
  backendHealth: BackendHealthResponse | null;
  lastRequestId: string;
  diagnosticGuidance: string[];
  refreshHealth: () => void;
  runHistory: RunResult[];
  exportHistory: () => void;
};

export function OutputPanel({
  status,
  errorKind,
  resultTitle,
  analysis,
  remarks,
  findings,
  isMockResult,
  onRetry,
  sessionId,
  sessionTimestamp,
  mode,
  lastInferenceMode,
  lastGenerationMode,
  backendReachability,
  backendHealth,
  lastRequestId,
  diagnosticGuidance,
  refreshHealth,
  runHistory,
  exportHistory,
}: OutputPanelProps) {
  const errorMessage = findings.find((f) => f.isError)?.text;

  return (
    <div className="flex flex-col gap-4">
      <Card title="What we found">
        {status === 'idle' || status === 'loading' ? (
          <div>
            <div className="text-muted flex items-start gap-3 text-[13px]">
              <StarGlyph size={18} className="mt-px text-sage-600" />
              <span>
                {status === 'loading'
                  ? 'Listening to the model…'
                  : 'Nothing yet — run something and results will light up here.'}
              </span>
            </div>
            <TrustLegend />
          </div>
        ) : null}

        {status === 'results' ? (
          <div>
            <h6 className="font-[family-name:var(--font-heading)] text-[16px] tracking-normal normal-case">
              {resultTitle}
            </h6>
            <p className="text-muted mt-2 text-[13px] leading-relaxed">{analysis}</p>
            {remarks ? (
              <p className="text-muted mt-3 text-[11px] leading-relaxed">{remarks}</p>
            ) : null}
            {isMockResult ? <MockNotice /> : null}
          </div>
        ) : null}

        {status === 'error' ? (
          <div>
            {errorKind === 'validation' ? (
              <p className="text-[13px] leading-relaxed">{errorMessage}</p>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed">
                  We couldn’t reach the model — it’s not you. The backend isn’t answering.
                </p>
                <p className="mt-3 text-[12px] font-semibold">Things to try:</p>
                <ul className="text-muted mt-1 text-[12.5px] leading-[1.7]">
                  <li>· Check the backend is running</li>
                  <li>· Check the address in settings</li>
                  <li>· Wait a moment, then retry</li>
                </ul>
                {errorMessage ? (
                  <p className="text-muted mt-3 text-[11px] break-words">{errorMessage}</p>
                ) : null}
              </>
            )}
            <button type="button" onClick={onRetry} className="btn btn-secondary mt-4">
              Try again
            </button>
          </div>
        ) : null}
      </Card>

      <Card title="Watching for">
        {status === 'results' && findings.length > 0 ? (
          <FindingRows findings={findings} />
        ) : (
          <WaitingRows listening={status === 'loading'} />
        )}
      </Card>

      <p className="flex items-center gap-3 rounded-[20px] bg-accent-100 px-5 py-3 text-[12.5px] text-accent-800">
        <StarGlyph size={16} />
        {DISCLAIMER}
      </p>

      <UnderTheHood
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
        runHistory={runHistory}
        exportHistory={exportHistory}
      />

      <p className="text-muted text-center text-[11px]">
        session {sessionId} · started {sessionTimestamp.split('T')[1] ?? sessionTimestamp} ·{' '}
        {lastInferenceMode === 'mock' ? 'mock model' : `${lastInferenceMode} model`}
      </p>
    </div>
  );
}
