'use client';

import { useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';

import { API_BASE_URL, API_KEY } from '../../lib/api';
import { MODE_LABELS } from '../../lib/copy';
import type {
  BackendHealthResponse,
  BackendReachability,
  GenerationMode,
  InferenceMode,
  Mode,
  RunResult,
} from '../../lib/types';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted text-[11px]">{label}</dt>
      <dd className="truncate text-[11px]">{value}</dd>
    </>
  );
}

type Props = {
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

/**
 * Everything an operator needs and a visitor doesn't — session, backend
 * wiring, request IDs and run history — folded away behind one control.
 */
export function UnderTheHood({
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
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="btn btn-secondary w-full justify-between font-[family-name:var(--font-body)] text-[12px]"
      >
        <span>Under the hood — session, backend, request IDs</span>
        <ChevronDown
          size={14}
          strokeWidth={2.75}
          aria-hidden="true"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {isOpen ? (
        <div className="flex flex-col gap-5 rounded-[24px] bg-surface px-6 py-5">
          <section>
            <h6 className="text-muted mb-2">Session</h6>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <Field label="Session" value={<span className="font-mono">{sessionId}</span>} />
              <Field label="Started" value={sessionTimestamp} />
              <Field label="Mode" value={MODE_LABELS[mode]} />
              <Field label="Inference" value={lastInferenceMode} />
              <Field label="Generation" value={lastGenerationMode} />
            </dl>
          </section>

          <section>
            <h6 className="text-muted mb-2">Backend</h6>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <Field
                label="Status"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        background:
                          backendReachability === 'online'
                            ? 'var(--color-sage-600)'
                            : backendReachability === 'offline'
                              ? 'var(--color-accent-600)'
                              : 'var(--color-neutral-500)',
                      }}
                      aria-hidden="true"
                    />
                    {backendReachability}
                  </span>
                }
              />
              <Field label="API" value={<span className="font-mono">{API_BASE_URL}</span>} />
              <Field label="Key" value={API_KEY.trim() ? 'configured' : 'not set'} />
              <Field label="Queue" value={backendHealth?.queue_backend ?? 'unknown'} />
              <Field label="Inference" value={backendHealth?.inference_mode ?? 'unknown'} />
              <Field label="Generate" value={backendHealth?.generate_mode ?? 'unknown'} />
              {backendHealth?.async_job_queue_enabled ? (
                <Field
                  label="Queue depth"
                  value={`${backendHealth.job_queue_depth ?? '?'} / ${backendHealth.job_queue_max_pending ?? '?'}`}
                />
              ) : null}
              <Field label="Tribe" value={backendHealth?.tribe_model_status ?? 'unknown'} />
              <Field
                label="Request ID"
                value={<span className="font-mono">{lastRequestId}</span>}
              />
            </dl>
          </section>

          <section>
            <h6 className="text-muted mb-2">Guidance</h6>
            <ul className="flex flex-col gap-1">
              {diagnosticGuidance.map((item, i) => (
                <li
                  key={`${item}-${i}`}
                  className="text-muted border-l pl-3 text-[11px] leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {runHistory.length > 0 ? (
            <section>
              <h6 className="text-muted mb-2">Earlier runs</h6>
              <ul className="flex flex-col gap-2">
                {runHistory.slice(0, 5).map((run) => (
                  <li
                    key={run.id}
                    className="rounded-[16px] bg-neutral-100 px-4 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{MODE_LABELS[run.mode]}</span>
                      <span className="text-muted">
                        {new Date(run.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-muted truncate">{run.analysis.split('\n')[0]}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshHealth} className="btn btn-secondary">
              Check again
            </button>
            {runHistory.length > 0 ? (
              <button type="button" onClick={exportHistory} className="btn btn-ghost">
                <Download size={14} strokeWidth={2.75} aria-hidden="true" />
                Export JSON
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
