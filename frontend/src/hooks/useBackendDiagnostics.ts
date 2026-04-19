import { useState, useCallback, useEffect, useMemo } from 'react';
import { fetchHealth } from '../lib/api';
import {
  BackendHealthResponse,
  BackendReachability,
  InferenceMode,
  GenerationMode,
} from '../lib/types';

function normalizeInferenceMode(value: unknown): InferenceMode {
  if (value === 'mock' || value === 'tribe') return value;
  return 'unknown';
}


export function useBackendDiagnostics(lastBackendError: string) {
  const [backendReachability, setBackendReachability] = useState<BackendReachability>('checking');
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null);
  const [lastInferenceMode, setLastInferenceMode] = useState<InferenceMode>('unknown');
  const [lastRequestId, setLastRequestId] = useState<string>('none');

  const refreshHealth = useCallback(async (allowStateUpdate: () => boolean = () => true) => {
    try {
      if (!allowStateUpdate()) return;
      setBackendReachability('checking');
      const { payload, requestId } = await fetchHealth();
      if (!allowStateUpdate()) return;
      
      setLastRequestId(requestId);
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

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
    const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

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

  return {
    backendHealth,
    backendReachability,
    lastInferenceMode,
    lastRequestId,
    diagnosticGuidance,
    refreshHealth,
    setLastRequestId,
    setLastInferenceMode,
  };
}
