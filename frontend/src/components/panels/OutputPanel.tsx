'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Download,
  AlertTriangle,
  Activity,
  Clock,
  Shield,
} from 'lucide-react';
import {
  Mode,
  InferenceMode,
  GenerationMode,
  BackendHealthResponse,
  BackendReachability,
  RunResult,
} from '../../lib/types';
import { API_BASE_URL, API_KEY } from '../../lib/api';

type OutputPanelProps = {
  analysis: string;
  findings: string[];
  remarks: string;
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
  isMockResult: boolean;
  evidenceTags: string[];
  runHistory: RunResult[];
  exportHistory: () => void;
};

function EvidenceTagBadge({ tag }: { tag: string }) {
  return (
    <span className={`evidence-tag ${tag}`}>
      {tag === 'observed' && '◉'}
      {tag === 'inferred' && '◈'}
      {tag === 'hypothesis' && '◇'}
      {tag === 'low_confidence' && '⚠'}
      {' '}{tag.replace('_', ' ')}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        aria-expanded={isOpen}
        aria-label={`Toggle ${title}`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-white/30" />
          <span className="section-label">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/30" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OutputPanel({
  analysis,
  findings,
  remarks,
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
  isMockResult,
  evidenceTags,
  runHistory,
  exportHistory,
}: OutputPanelProps) {
  return (
    <div className="space-y-4">
      {/* Mock Mode Banner (AR2) */}
      {isMockResult && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mock-banner"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Synthetic Output — Mock inference mode active</span>
        </motion.div>
      )}

      {/* Evidence Tags Row */}
      {evidenceTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {evidenceTags.map((tag, i) => (
            <EvidenceTagBadge key={`${tag}-${i}`} tag={tag} />
          ))}
        </div>
      )}

      {/* Analysis Card */}
      <div className="result-card">
        <div className="section-label accent mb-3">Analysis</div>
        <div className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed">
          {analysis}
        </div>
      </div>

      {/* Findings */}
      <div className="result-card">
        <div className="section-label mb-3">Findings</div>
        <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
          {findings.map((finding, i) => (
            <motion.div
              key={`${finding}-${i}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-xs text-white/65 flex items-start gap-2"
            >
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  background: finding.startsWith('ERROR')
                    ? 'var(--tag-low-confidence)'
                    : 'var(--accent)',
                  boxShadow: finding.startsWith('ERROR')
                    ? '0 0 6px rgba(248,113,113,0.4)'
                    : '0 0 6px var(--accent-glow)',
                }}
              />
              <span>{finding}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Remarks / Disclaimer */}
      {remarks && remarks !== 'Awaiting computational logic instructions...' && (
        <div className="disclaimer-callout">
          {remarks}
        </div>
      )}

      {/* Run History (UX5) */}
      {runHistory.length > 0 && (
        <CollapsibleSection title="Run History" icon={Clock} defaultOpen={false}>
          <div className="space-y-2">
            {runHistory.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white/60">
                    {run.mode.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-white/30">
                    {new Date(run.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-white/40 truncate">{run.analysis.split('\n')[0]}</div>
                {run.evidenceTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {run.evidenceTags.map((t, j) => (
                      <span key={j} className={`evidence-tag ${t}`} style={{ fontSize: '8px', padding: '1px 6px' }}>
                        {t.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={exportHistory}
              className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white/60 transition-colors"
              aria-label="Export run history as JSON"
            >
              <Download className="w-3 h-3" />
              Export JSON
            </button>
          </div>
        </CollapsibleSection>
      )}

      {/* Session Info */}
      <CollapsibleSection title="Session" icon={Activity} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
          <span className="text-white/30">Session</span>
          <span className="text-white/55 font-mono">{sessionId}</span>
          <span className="text-white/30">Mode</span>
          <span className="text-white/55">{mode.toUpperCase()}</span>
          <span className="text-white/30">Started</span>
          <span className="text-white/55">{sessionTimestamp}</span>
          <span className="text-white/30">Inference</span>
          <span className="text-white/55">{lastInferenceMode.toUpperCase()}</span>
          <span className="text-white/30">Generation</span>
          <span className="text-white/55">{lastGenerationMode.toUpperCase()}</span>
        </div>
      </CollapsibleSection>

      {/* Backend Diagnostics — collapsed by default */}
      <CollapsibleSection title="Diagnostics" icon={Shield} defaultOpen={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <span className="text-white/30">API</span>
            <span className="text-white/50 font-mono truncate">{API_BASE_URL}</span>
            <span className="text-white/30">Key</span>
            <span className="text-white/50">{API_KEY.trim() ? '✓ configured' : '✗ not set'}</span>
            <span className="text-white/30">Status</span>
            <span className="flex items-center gap-1.5">
              <span className={`status-dot ${backendReachability === 'online' ? 'online' : backendReachability === 'offline' ? 'offline' : 'checking'}`} />
              <span className="text-white/50 text-[10px]">{backendReachability.toUpperCase()}</span>
            </span>
            <span className="text-white/30">Queue</span>
            <span className="text-white/50">{(backendHealth?.queue_backend ?? 'unknown').toUpperCase()}</span>
            <span className="text-white/30">Inference</span>
            <span className="text-white/50">{(backendHealth?.inference_mode ?? 'unknown').toUpperCase()}</span>
            <span className="text-white/30">Generate</span>
            <span className="text-white/50">{(backendHealth?.generate_mode ?? 'unknown').toUpperCase()}</span>
            {backendHealth?.async_job_queue_enabled && (
              <>
                <span className="text-white/30">Queue Depth</span>
                <span className="text-white/50">
                  {backendHealth.job_queue_depth ?? '?'} / {backendHealth.job_queue_max_pending ?? '?'}
                </span>
              </>
            )}
            <span className="text-white/30">Tribe</span>
            <span className="text-white/50">{backendHealth?.tribe_model_status ?? 'unknown'}</span>
            <span className="text-white/30">Request ID</span>
            <span className="text-white/50 font-mono truncate">{lastRequestId}</span>
          </div>

          {/* Guidance */}
          <div className="space-y-1.5">
            <div className="section-label text-[9px]">Guidance</div>
            {diagnosticGuidance.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="text-[10px] text-white/45 pl-2.5 border-l border-white/10 leading-relaxed"
              >
                {item}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="w-full py-2 text-[10px] uppercase tracking-widest border border-white/10 rounded-lg text-white/40 hover:border-white/20 hover:text-white/60 transition-all"
            aria-label="Refresh backend health check"
          >
            Refresh Health
          </button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
