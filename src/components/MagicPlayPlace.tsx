'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Star, Upload } from 'lucide-react';

type Mode = 'discovery' | 'therapeutics' | 'conditioning';
type NeurologicalProfile = 'neurotypical' | 'adhd' | 'asd';
type AgeCohort = 'youth' | 'adult' | 'elderly';
type Modality = 'audio' | 'text' | 'image';
type StimulusType = 'text' | 'image' | 'video' | 'audio';
type InferenceMode = 'mock' | 'tribe' | 'unknown';
type GenerationMode = 'simulation' | 'model_loop' | 'unknown';
type BackendReachability = 'checking' | 'online' | 'offline';
type BackendHealthResponse = {
  status?: string;
  queue_backend?: string;
  inference_mode?: string;
  generate_mode?: string;
  generate_model_loop_validated?: boolean;
  generate_model_loop_validation_report_configured?: boolean;
  generate_model_loop_validation_report?: string;
  generate_model_loop_signed_off?: boolean;
  generate_model_loop_signoff_report_configured?: boolean;
  generate_model_loop_signoff_report?: string;
  generate_model_loop_iterations?: number;
  metrics_enabled?: boolean;
  metrics_require_api_key?: boolean;
  otel_enabled?: boolean;
  otel_service_name?: string;
  tribe_model_status?: string;
  tribe_checkpoint_configured?: boolean;
  max_upload_mb?: number;
  upload_ttl_hours?: number;
  upload_cleanup_interval_seconds?: number;
  delete_uploads_after_inference?: boolean;
  api_key_required?: boolean;
  rate_limit_enabled?: boolean;
  rate_limit_window_seconds?: number;
  rate_limit_max_requests?: number;
  async_job_queue_enabled?: boolean;
  job_worker_concurrency?: number;
  job_queue_max_pending?: number;
  job_queue_depth?: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

function mapAgeCohort(cohort: AgeCohort): 'child' | 'adult' | 'elderly' {
  if (cohort === 'youth') return 'child';
  return cohort;
}

function getAcceptForStimulus(type: StimulusType): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'audio') return 'audio/*';
  return '';
}

function normalizeInferenceMode(value: unknown): InferenceMode {
  if (value === 'mock' || value === 'tribe') return value;
  return 'unknown';
}

function normalizeGenerationMode(value: unknown): GenerationMode {
  if (value === 'simulation' || value === 'model_loop') return value;
  return 'unknown';
}

function createClientRequestId(): string {
  return `ui-${Math.random().toString(36).slice(2, 12)}`;
}

function buildRequestHeaders(baseHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...baseHeaders, 'X-Request-ID': createClientRequestId() };
  if (API_KEY.trim()) {
    headers['X-API-Key'] = API_KEY.trim();
  }
  return headers;
}

export default function MagicPlayPlace() {
  const [mode, setMode] = useState<Mode>('discovery');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<NeurologicalProfile>('neurotypical');
  const [cohort, setCohort] = useState<AgeCohort>('adult');
  const [valence, setValence] = useState(50);
  const [arousal, setArousal] = useState(50);
  const [modality, setModality] = useState<Modality>('audio');
  const [stimulusType, setStimulusType] = useState<StimulusType>('text');
  const [textInput, setTextInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [analysis, setAnalysis] = useState(
    'Configure inputs, then run the algorithm to generate neural response analysis.'
  );
  const [remarks, setRemarks] = useState('Awaiting computational logic instructions...');
  const [findings, setFindings] = useState<string[]>([
    'Neural pathway correlation: pending',
    'Dopamine receptor activation: pending',
    'Prefrontal cortex engagement: pending',
  ]);
  const [lastInferenceMode, setLastInferenceMode] = useState<InferenceMode>('unknown');
  const [lastGenerationMode, setLastGenerationMode] = useState<GenerationMode>('unknown');
  const [backendReachability, setBackendReachability] = useState<BackendReachability>('checking');
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [lastBackendError, setLastBackendError] = useState<string>('none');
  const [lastRequestId, setLastRequestId] = useState<string>('none');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useMemo(
    () => `NRL-${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
    []
  );
  const sessionTimestamp = useMemo(
    () => new Date().toISOString().split('.')[0],
    []
  );

  const openFilePicker = () => {
    if (stimulusType === 'text') return;
    fileInputRef.current?.click();
  };

  const parseError = async (response: Response, fallback: string) => {
    try {
      const payload = await response.json();
      const detail = payload?.detail ?? payload?.message;
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }
    } catch {
      // no-op
    }
    return fallback;
  };

  const refreshHealth = useCallback(async (allowStateUpdate: () => boolean = () => true) => {
    try {
      if (!allowStateUpdate()) return;
      setBackendReachability('checking');
      const response = await fetch(`${API_BASE_URL}/admin/status`, {
        headers: buildRequestHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Health endpoint failed (${response.status}).`);
      }
      const payload = (await response.json()) as BackendHealthResponse;
      if (!allowStateUpdate()) return;
      setLastRequestId(response.headers.get('x-request-id') ?? 'none');
      setBackendHealth(payload);
      setBackendReachability('online');
      setLastInferenceMode(normalizeInferenceMode(payload?.inference_mode));
    } catch {
      if (!allowStateUpdate()) return;
      setBackendReachability('offline');
      setBackendHealth(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const runHealthCheck = async () => {
      await refreshHealth(() => isMounted);
    };

    void runHealthCheck();
    const interval = setInterval(() => {
      void runHealthCheck();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshHealth]);

  const diagnosticGuidance = useMemo(() => {
    const guidance: string[] = [];

    if (backendReachability === 'offline') {
      guidance.push(`Backend unreachable at ${API_BASE_URL}. Verify backend server and NEXT_PUBLIC_API_BASE_URL.`);
    }
    if (backendHealth?.inference_mode === 'tribe' && !backendHealth?.tribe_checkpoint_configured) {
      guidance.push('INFERENCE_MODE is tribe but TRIBEV2_CHECKPOINT_DIR is not configured.');
    }
    if (backendHealth?.async_job_queue_enabled === false) {
      guidance.push('Async queue endpoints are disabled. Enable ASYNC_JOB_QUEUE_ENABLED for high-load jobs.');
    }
    if (backendHealth?.queue_backend === 'inmemory') {
      guidance.push('Queue backend is in-memory. Use QUEUE_BACKEND=redis for durable multi-instance workers.');
    }
    if (backendHealth?.generate_mode === 'model_loop' && !backendHealth?.generate_model_loop_validated) {
      guidance.push('GENERATE_MODE is model_loop but validation gate is not confirmed.');
    }
    if (backendHealth?.generate_mode === 'model_loop' && !backendHealth?.generate_model_loop_signed_off) {
      guidance.push('GENERATE_MODE is model_loop but Gate 3 sign-off is not confirmed.');
    }
    if (backendHealth?.api_key_required && !API_KEY.trim()) {
      guidance.push('Backend requires API key but NEXT_PUBLIC_API_KEY is not configured in frontend env.');
    }
    if (backendHealth?.tribe_model_status?.startsWith('error:')) {
      guidance.push(`Tribe model failed to load: ${backendHealth.tribe_model_status}`);
    }
    if (lastBackendError.includes('MAX_UPLOAD_MB')) {
      guidance.push('Upload rejected by file size limit. Reduce file size or raise MAX_UPLOAD_MB.');
    }
    if (lastBackendError.includes('MAX_TEXT_CHARS')) {
      guidance.push('Text prompt exceeded configured max length. Reduce prompt or raise MAX_TEXT_CHARS.');
    }
    if (
      lastBackendError.includes('Content-Type') ||
      lastBackendError.includes('does not match extension') ||
      lastBackendError.includes('Corrupted WAV file')
    ) {
      guidance.push('Media validation failed. Ensure file extension, MIME type, and binary format all match.');
    }
    if (lastBackendError.includes('API key required') || lastBackendError.includes('Invalid API key')) {
      guidance.push('Backend auth rejected this request. Configure and send a valid API key.');
    }
    if (lastBackendError.includes('Rate limit exceeded')) {
      guidance.push('Rate limit reached. Wait for the window reset or adjust backend rate policy.');
    }
    if (backendHealth?.metrics_enabled === false) {
      guidance.push('Metrics endpoint is disabled. Enable METRICS_ENABLED for runtime observability.');
    }

    if (guidance.length === 0) {
      guidance.push('No active diagnostics warnings.');
    }
    return guidance;
  }, [backendReachability, backendHealth, lastBackendError]);

  const handleRunAlgorithm = async () => {
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    setIsProcessing(true);
    setProgress(2);

    progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 3));
    }, 150);

    try {
      if (mode === 'discovery') {
        if (stimulusType === 'text' && !textInput.trim()) {
          throw new Error('Please enter text input before running discovery mode.');
        }
        if (stimulusType !== 'text' && !mediaFile) {
          throw new Error(`Please upload a ${stimulusType} file before running discovery mode.`);
        }

        const formData = new FormData();
        formData.append('profile', profile);
        formData.append('age', mapAgeCohort(cohort));

        if (stimulusType === 'text') {
          formData.append('text_prompt', textInput.trim());
        } else if (mediaFile) {
          formData.append('media', mediaFile);
        }

        const response = await fetch(`${API_BASE_URL}/predict`, {
          method: 'POST',
          headers: buildRequestHeaders(),
          body: formData,
        });
        const responseRequestId = response.headers.get('x-request-id');
        if (!response.ok) {
          const detail = await parseError(response, 'Failed to call backend /predict endpoint.');
          if (responseRequestId) setLastRequestId(responseRequestId);
          throw new Error(detail);
        }

        const data = await response.json();
        setLastRequestId(responseRequestId ?? 'none');
        const description = data?.insights?.description ?? data?.message ?? 'Prediction complete.';
        const crossModal =
          data?.insights?.cross_modal_guide ??
          'No cross-modal recommendation was returned by the backend.';
        const evidenceTags = Array.isArray(data?.evidence_tags) ? data.evidence_tags.join(', ') : 'n/a';
        const disclaimer =
          data?.scientific_disclaimer ?? 'Research-use output only. Not clinical advice.';

        setAnalysis(description);
        setRemarks(`${crossModal}\n\nDisclaimer: ${disclaimer}`);
        setLastInferenceMode(normalizeInferenceMode(data?.inference_mode));
        setLastBackendError('none');
        setFindings((prev) => [
          `DISCOVERY completed (${stimulusType.toUpperCase()})`,
          `Output shape: ${data?.timesteps ?? 'n/a'} timesteps x ${data?.vertices ?? 'n/a'} vertices`,
          `Evidence tags: ${evidenceTags}`,
          ...prev.slice(0, 3),
        ]);
      } else if (mode === 'therapeutics') {
        const response = await fetch(`${API_BASE_URL}/generate`, {
          method: 'POST',
          headers: buildRequestHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            valence,
            arousal,
            modality,
            profile,
            age: mapAgeCohort(cohort),
          }),
        });
        const responseRequestId = response.headers.get('x-request-id');
        if (!response.ok) {
          const detail = await parseError(response, 'Failed to call backend /generate endpoint.');
          if (responseRequestId) setLastRequestId(responseRequestId);
          throw new Error(detail);
        }
        const data = await response.json();
        setLastRequestId(responseRequestId ?? 'none');
        const metrics = data?.optimization_metrics;
        const metricSummary =
          metrics && typeof metrics === 'object'
            ? `\nBaseline distance: ${metrics.baseline_distance ?? 'n/a'}\nFinal distance: ${
                metrics.final_distance ?? 'n/a'
              }\nImprovement: ${metrics.improvement ?? 'n/a'}`
            : '';
        const validationRef = data?.validation_reference
          ? `\nValidation ref: ${data.validation_reference}`
          : '';
        setAnalysis(
          `Therapeutics ${String(data?.generation_mode ?? 'simulation').toUpperCase()} complete.\nIterations: ${
            data?.iterations ?? 'n/a'
          }\nPayload: ${
            data?.generated_payload ?? 'n/a'
          }${metricSummary}${validationRef}`
        );
        setRemarks(
          `${data?.scientific_disclaimer ?? 'Simulation mode only.'}\n\nTarget baseline: ${profile.toUpperCase()} / ${cohort.toUpperCase()}.`
        );
        setLastInferenceMode(normalizeInferenceMode(data?.inference_mode));
        setLastGenerationMode(normalizeGenerationMode(data?.generation_mode));
        setLastBackendError('none');
        setFindings((prev) => [
          'THERAPEUTICS simulation completed',
          `Target vectors: valence=${valence}, arousal=${arousal}, modality=${modality}`,
          ...prev.slice(0, 3),
        ]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 900));
        setAnalysis(
          `Conditioning profile applied.\nNeurological profile: ${profile.toUpperCase()}\nAge cohort: ${cohort.toUpperCase()}`
        );
        setRemarks(
          'Future discovery and therapeutics runs will be evaluated under the updated demographic substrate.'
        );
        setLastBackendError('none');
        setFindings((prev) => [
          'CONDITIONING baseline updated',
          `Active cohort: ${profile}/${cohort}`,
          ...prev.slice(0, 3),
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error occurred.';
      const requestMatch = message.match(/\[([a-f0-9]{12})\]/i);
      if (requestMatch?.[1]) {
        setLastRequestId(requestMatch[1]);
      }
      setLastBackendError(message);
      setAnalysis(message);
      setRemarks('Check backend availability (default: http://localhost:8000) and input validity.');
      setFindings((prev) => [`ERROR: ${message}`, ...prev.slice(0, 4)]);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setProgress(100);
      setIsProcessing(false);
      await refreshHealth();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-4">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-emerald-500" fill="currentColor" />
            <h1 className="text-xl tracking-[0.2em] uppercase">Magic Play Place</h1>
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
                {m}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-0 xl:h-[calc(100vh-73px)]">
        <div className="border-b xl:border-b-0 xl:border-r border-white/10 p-4 sm:p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="text-xs tracking-[0.15em] uppercase text-emerald-500 mb-6">Control Panel</div>

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
                        className="w-full border border-dashed border-white/20 group-hover:border-emerald-500/50 p-8 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
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
                    <div className="grid grid-cols-3 gap-2">
                      {(['audio', 'text', 'image'] as Modality[]).map((m) => (
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

            <motion.button
              onClick={handleRunAlgorithm}
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
                {mode === 'therapeutics'
                  ? backendHealth?.generate_mode === 'model_loop'
                    ? 'Run Model Loop'
                    : 'Run Sim Loop'
                  : 'Run Algorithm'}
              </span>
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 sm:p-8 xl:p-12 relative border-b xl:border-b-0 border-white/10">
          <div className="w-full max-w-xl space-y-8">
            <div className="flex flex-wrap gap-3 justify-between text-xs uppercase tracking-wide">
              <div className="text-white/60">
                Model: <span className="text-emerald-500">Tribe v2</span>
              </div>
              <div className="text-white/60">
                Profile: <span className="text-white">{profile}</span>
              </div>
              <div className="text-white/60">
                Status:{' '}
                <span className={isProcessing ? 'text-emerald-500' : 'text-white'}>
                  {isProcessing ? 'Processing' : 'Ready'}
                </span>
              </div>
            </div>

            <motion.div
              className="aspect-square border border-white/20 relative overflow-hidden"
              style={{
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
              }}
              animate={{
                boxShadow: isProcessing
                  ? '0 0 40px rgba(16, 185, 129, 0.5)'
                  : '0 0 20px rgba(16, 185, 129, 0.2)',
              }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-64 h-64 rounded-full border-2 border-emerald-500/30"
                  animate={{
                    scale: isProcessing ? [1, 1.05, 1] : 1,
                    opacity: isProcessing ? [0.3, 0.6, 0.3] : 0.3,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isProcessing ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="absolute w-48 h-48 rounded-full border border-emerald-500/50"
                  animate={{
                    scale: isProcessing ? [1, 1.1, 1] : 1,
                    opacity: isProcessing ? [0.5, 0.8, 0.5] : 0.5,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isProcessing ? Infinity : 0,
                    ease: 'easeInOut',
                    delay: 0.3,
                  }}
                />
                <motion.div
                  className="absolute w-32 h-32 rounded-full border-2 border-emerald-500"
                  animate={{
                    scale: isProcessing ? [1, 1.15, 1] : 1,
                    opacity: isProcessing ? [0.7, 1, 0.7] : 0.7,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isProcessing ? Infinity : 0,
                    ease: 'easeInOut',
                    delay: 0.6,
                  }}
                />
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-500" />
              </div>
            </motion.div>

            <div className="space-y-2">
              <div className="h-1 bg-white/10 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-emerald-500"
                  style={{ width: `${progress}%` }}
                  animate={{
                    boxShadow: isProcessing
                      ? '0 0 10px rgba(16, 185, 129, 0.8)'
                      : '0 0 0px rgba(16, 185, 129, 0)',
                  }}
                />
              </div>
              {(isProcessing || progress === 100) && (
                <div className="text-xs text-emerald-500 text-center tracking-wide">{progress}% COMPLETE</div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:border-l border-white/10 p-4 sm:p-6 overflow-y-auto">
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
                <div>
                  Report Ref: {backendHealth?.generate_model_loop_validation_report ?? 'not set'}
                </div>
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
                <div>
                  Sign-off Ref: {backendHealth?.generate_model_loop_signoff_report ?? 'not set'}
                </div>
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
        </div>
      </div>

      <style>{`
        .slider-emerald::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #10b981;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .slider-emerald::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #10b981;
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 2px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
    </div>
  );
}
