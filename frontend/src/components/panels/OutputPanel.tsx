import { motion } from 'framer-motion';
import {
  Mode,
  InferenceMode,
  GenerationMode,
  BackendHealthResponse,
  BackendReachability,
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
};

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
}: OutputPanelProps) {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs tracking-[0.15em] uppercase text-emerald-500 mb-4">Findings Analysis</div>
        <div className="text-xs border border-white/10 bg-white/5 p-4 whitespace-pre-wrap text-white/80 leading-relaxed">
          {analysis}
        </div>
        <div className="space-y-3 h-44 overflow-y-auto scrollbar-thin mt-4">
          {findings.map((finding, i) => (
            <motion.div
              key={`${finding}-${i}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="text-xs border-l-2 border-emerald-500/50 pl-3 py-2 text-white/80"
            >
              {finding}
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs tracking-[0.15em] uppercase text-white/60 mb-4">System Remarks</div>
        <div className="text-xs border border-white/10 bg-white/5 p-4 whitespace-pre-wrap text-white/70 leading-relaxed">
          {remarks}
        </div>
      </div>

      <div className="p-4 border border-white/10 bg-white/5">
        <div className="text-xs tracking-wide uppercase text-white/40 mb-3">Session Info</div>
        <div className="space-y-1 text-xs text-white/60">
          <div>Session ID: {sessionId}</div>
          <div>Mode: {mode.toUpperCase()}</div>
          <div>Timestamp: {sessionTimestamp}</div>
          <div>Inference: {lastInferenceMode.toUpperCase()}</div>
          <div>Generation: {lastGenerationMode.toUpperCase()}</div>
        </div>
      </div>

      <div className="p-4 border border-white/10 bg-white/5">
        <div className="text-xs tracking-wide uppercase text-white/40 mb-3">Backend Diagnostics</div>
        <div className="space-y-1 text-xs text-white/60">
          <div>API Base: {API_BASE_URL}</div>
          <div>Client API Key: {API_KEY.trim() ? 'configured' : 'not set'}</div>
          <div>Reachability: {backendReachability.toUpperCase()}</div>
          <div>Queue Backend: {(backendHealth?.queue_backend ?? 'unknown').toUpperCase()}</div>
          <div>Mode: {(backendHealth?.inference_mode ?? 'unknown').toUpperCase()}</div>
          <div>Generate Mode: {(backendHealth?.generate_mode ?? 'unknown').toUpperCase()}</div>
          <div>
            Loop Validated:{' '}
            {backendHealth?.generate_model_loop_validated === undefined
              ? 'unknown'
              : backendHealth.generate_model_loop_validated
              ? 'yes'
              : 'no'}
          </div>
          <div>Loop Iterations: {backendHealth?.generate_model_loop_iterations ?? 'unknown'}</div>
          <div>
            Validation Report:{' '}
            {backendHealth?.generate_model_loop_validation_report_configured === undefined
              ? 'unknown'
              : backendHealth.generate_model_loop_validation_report_configured
              ? 'configured'
              : 'not configured'}
          </div>
          <div>Report Ref: {backendHealth?.generate_model_loop_validation_report ?? 'not set'}</div>
          <div>
            Loop Signed Off:{' '}
            {backendHealth?.generate_model_loop_signed_off === undefined
              ? 'unknown'
              : backendHealth.generate_model_loop_signed_off
              ? 'yes'
              : 'no'}
          </div>
          <div>
            Sign-off Report:{' '}
            {backendHealth?.generate_model_loop_signoff_report_configured === undefined
              ? 'unknown'
              : backendHealth.generate_model_loop_signoff_report_configured
              ? 'configured'
              : 'not configured'}
          </div>
          <div>Sign-off Ref: {backendHealth?.generate_model_loop_signoff_report ?? 'not set'}</div>
          <div>Tribe Status: {backendHealth?.tribe_model_status ?? 'unknown'}</div>
          <div>Checkpoint: {backendHealth?.tribe_checkpoint_configured ? 'configured' : 'not configured'}</div>
          <div>Max Upload MB: {backendHealth?.max_upload_mb ?? 'unknown'}</div>
          <div>Retention TTL (h): {backendHealth?.upload_ttl_hours ?? 'unknown'}</div>
          <div>
            Metrics Endpoint:{' '}
            {backendHealth?.metrics_enabled === undefined
              ? 'unknown'
              : backendHealth.metrics_enabled
              ? 'enabled'
              : 'disabled'}
          </div>
          <div>
            OTEL Tracing:{' '}
            {backendHealth?.otel_enabled === undefined
              ? 'unknown'
              : backendHealth.otel_enabled
              ? 'enabled'
              : 'disabled'}
          </div>
          <div>OTEL Service: {backendHealth?.otel_service_name ?? 'unknown'}</div>
          <div>
            API Key Required:{' '}
            {backendHealth?.api_key_required === undefined
              ? 'unknown'
              : backendHealth.api_key_required
              ? 'yes'
              : 'no'}
          </div>
          <div>
            Rate Limit:{' '}
            {backendHealth?.rate_limit_enabled === undefined
              ? 'unknown'
              : backendHealth.rate_limit_enabled
              ? `${backendHealth.rate_limit_max_requests ?? '?'} / ${
                  backendHealth.rate_limit_window_seconds ?? '?'
                }s`
              : 'disabled'}
          </div>
          <div>
            Async Queue:{' '}
            {backendHealth?.async_job_queue_enabled === undefined
              ? 'unknown'
              : backendHealth.async_job_queue_enabled
              ? `${backendHealth.job_queue_depth ?? '?'} queued of ${backendHealth.job_queue_max_pending ?? '?'} max`
              : 'disabled'}
          </div>
          <div>Worker Concurrency: {backendHealth?.job_worker_concurrency ?? 'unknown'}</div>
          <div>
            Delete-after-inference:{' '}
            {backendHealth?.delete_uploads_after_inference === undefined
              ? 'unknown'
              : backendHealth.delete_uploads_after_inference
              ? 'enabled'
              : 'disabled'}
          </div>
          <div>Last Request ID: {lastRequestId}</div>
        </div>

        <div className="text-xs tracking-wide uppercase text-white/40 mt-4 mb-2">Guidance</div>
        <div className="space-y-2">
          {diagnosticGuidance.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="text-xs border-l-2 border-emerald-500/40 pl-3 py-1 text-white/75"
            >
              {item}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            void refreshHealth();
          }}
          className="mt-4 w-full py-2 text-xs uppercase tracking-wide border border-white/20 text-white/70 hover:border-emerald-500/60 hover:text-emerald-400 transition-colors"
        >
          Refresh Health
        </button>
      </div>
    </div>
  );
}
