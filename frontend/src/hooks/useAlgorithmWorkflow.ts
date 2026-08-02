import { useState, useMemo, useCallback } from 'react';
import { submitPredict, submitGenerate } from '../lib/api';
import {
  COHORT_LABELS,
  MODALITY_LABELS,
  PROFILE_LABELS,
  STIMULUS_LABELS,
} from '../lib/copy';
import {
  Mode,
  Finding,
  GenerationMode,
  Modality,
  RunStatus,
  StimulusType,
  NeurologicalProfile,
  AgeCohort,
  InferenceMode,
  RunResult,
} from '../lib/types';

function mapAgeCohort(cohort: AgeCohort): 'child' | 'adult' | 'elderly' {
  if (cohort === 'youth') return 'child';
  return cohort;
}

function normalizeGenerationMode(value: unknown): GenerationMode {
  if (value === 'simulation' || value === 'model_loop') return value;
  return 'unknown';
}

function normalizeInferenceMode(value: unknown): InferenceMode {
  if (value === 'mock' || value === 'tribe') return value;
  return 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Renders whatever the backend put in a metric slot without inventing one. */
function asMetric(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(+value.toFixed(3));
  return asText(value);
}

const MAX_HISTORY = 8;

export function useAlgorithmWorkflow(
  refreshHealth: () => Promise<void>,
  setLastRequestId: (id: string) => void,
  setLastInferenceMode: (mode: InferenceMode) => void
) {
  const [status, setStatus] = useState<RunStatus>('idle');
  /** Missing input is the user's to fix; anything else is ours. */
  const [errorKind, setErrorKind] = useState<'validation' | 'backend'>('backend');
  const [resultTitle, setResultTitle] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [remarks, setRemarks] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [lastGenerationMode, setLastGenerationMode] = useState<GenerationMode>('unknown');
  const [lastBackendError, setLastBackendError] = useState<string>('none');
  const [isMockResult, setIsMockResult] = useState(false);
  const [evidenceTags, setEvidenceTags] = useState<string[]>([]);
  const [runHistory, setRunHistory] = useState<RunResult[]>([]);

  const isProcessing = status === 'loading';

  const sessionId = useMemo(
    () => `NRL-${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
    []
  );
  const sessionTimestamp = useMemo(
    () => new Date().toISOString().split('.')[0],
    []
  );

  const addToHistory = useCallback((result: RunResult) => {
    setRunHistory((prev) => [result, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const exportHistory = useCallback(() => {
    const blob = new Blob([JSON.stringify(runHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpp-session-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [runHistory, sessionId]);

  const handleRunAlgorithm = async ({
    mode,
    profile,
    cohort,
    stimulusType,
    textInput,
    mediaFile,
    valence,
    arousal,
    modality,
  }: {
    mode: Mode;
    profile: NeurologicalProfile;
    cohort: AgeCohort;
    stimulusType: StimulusType;
    textInput: string;
    mediaFile: File | null;
    valence: number;
    arousal: number;
    modality: Modality;
  }) => {
    const who = `${PROFILE_LABELS[profile]} · ${COHORT_LABELS[cohort]}`;

    // UX6: Tune is instant — no fake processing.
    if (mode === 'conditioning') {
      const condTitle = 'Profile saved';
      const condAnalysis = `Done. Every run from now on models a ${PROFILE_LABELS[profile]} ${COHORT_LABELS[cohort]}.`;
      const condRemarks =
        'Explore and Shape runs will be read against this profile from here on.';
      const condFindings: Finding[] = [
        { text: 'Baseline updated', tag: 'observed' },
        { text: `Modelling for ${who}`, tag: 'observed' },
      ];
      setLastBackendError('none');
      setResultTitle(condTitle);
      setAnalysis(condAnalysis);
      setRemarks(condRemarks);
      setIsMockResult(false);
      setEvidenceTags([]);
      setFindings(condFindings);
      setStatus('results');
      addToHistory({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mode,
        analysis: condAnalysis,
        remarks: condRemarks,
        findings: condFindings,
        inferenceMode: 'unknown',
        generationMode: 'unknown',
        isMock: false,
        evidenceTags: [],
        params: { profile, cohort },
      });
      return;
    }

    setStatus('loading');
    let kind: 'validation' | 'backend' = 'backend';

    try {
      let resultTitleText = '';
      let resultAnalysis = '';
      let resultRemarks = '';
      let resultFindings: Finding[] = [];
      let resultInferenceMode: InferenceMode = 'unknown';
      let resultGenerationMode: GenerationMode = 'unknown';
      let resultIsMock = false;
      let resultTags: string[] = [];

      if (mode === 'discovery') {
        if (stimulusType === 'text' && !textInput.trim()) {
          kind = 'validation';
          throw new Error('Add a few words first, then run it.');
        }
        if (stimulusType !== 'text' && !mediaFile) {
          kind = 'validation';
          throw new Error(`Choose ${STIMULUS_LABELS[stimulusType]} first, then run it.`);
        }

        const formData = new FormData();
        formData.append('profile', profile);
        formData.append('age', mapAgeCohort(cohort));

        if (stimulusType === 'text') {
          formData.append('text_prompt', textInput.trim());
        } else if (mediaFile) {
          formData.append('media', mediaFile);
        }

        const { data, requestId } = await submitPredict(formData);
        const insights = asRecord(data?.insights);
        setLastRequestId(requestId);

        const description =
          asText(insights?.description) ?? asText(data?.message) ?? 'The run finished.';
        const crossModal = asText(insights?.cross_modal_guide);
        const tags = Array.isArray(data?.evidence_tags) ? data.evidence_tags.map(String) : [];
        const disclaimer =
          asText(data?.scientific_disclaimer) ?? 'Research-use output only. Not clinical advice.';
        const mockFlag =
          data?.mock_data === true ||
          (typeof insights?.mock_data === 'boolean' && insights.mock_data);

        const timesteps = asMetric(data?.timesteps);
        const vertices = asMetric(data?.vertices);

        resultTitleText = 'What the model saw';
        resultAnalysis = description;
        resultRemarks = disclaimer;
        resultInferenceMode = normalizeInferenceMode(data?.inference_mode);
        resultIsMock = !!mockFlag;
        resultTags = tags;
        resultFindings = [
          timesteps && vertices
            ? { text: `${timesteps} timesteps × ${vertices} vertices`, tag: 'observed' }
            : null,
          { text: `Read from ${STIMULUS_LABELS[stimulusType]}, for ${who}`, tag: 'observed' },
          crossModal ? { text: crossModal, tag: 'hypothesis' } : null,
        ].filter((f): f is Finding => f !== null);
      } else {
        const payloadData = {
          valence,
          arousal,
          modality,
          profile,
          age: mapAgeCohort(cohort),
        };

        const { data, requestId } = await submitGenerate(payloadData);
        setLastRequestId(requestId);

        const metrics =
          asRecord(data?.optimization_metrics) ?? asRecord(data?.simulated_optimization_metrics);
        const generationMode = normalizeGenerationMode(data?.generation_mode);
        const iterations = asMetric(data?.iterations);
        const generatedPayload = asText(data?.generated_payload);
        const validationReference = asText(data?.validation_reference);
        const scientificDisclaimer =
          asText(data?.scientific_disclaimer) ?? 'Simulation mode only.';
        const loopType = asText(data?.loop_type) ?? 'simulation';
        const improvement = asMetric(metrics?.improvement);
        const finalDistance = asMetric(metrics?.final_distance);
        const baselineDistance = asMetric(metrics?.baseline_distance);

        resultTitleText =
          generationMode === 'model_loop' ? 'Model loop finished' : 'Simulation finished';
        resultAnalysis = [
          `We simulated a ${MODALITY_LABELS[modality]}-based nudge toward mood ${valence} and energy ${arousal}.`,
          generatedPayload ? `It produced: ${generatedPayload}.` : null,
        ]
          .filter(Boolean)
          .join(' ');
        resultRemarks = scientificDisclaimer;
        resultInferenceMode = normalizeInferenceMode(data?.inference_mode);
        resultGenerationMode = generationMode;
        resultIsMock = loopType === 'simulation';
        resultTags = [];
        resultFindings = [
          iterations ? { text: `${iterations} iterations`, tag: 'observed' } : null,
          improvement
            ? { text: `Improvement: ${improvement}`, tag: 'observed' }
            : baselineDistance && finalDistance
              ? {
                  text: `Distance ${baselineDistance} → ${finalDistance}`,
                  tag: 'observed',
                }
              : null,
          { text: `Aimed for mood ${valence} · energy ${arousal}, for ${who}`, tag: 'observed' },
          validationReference
            ? { text: `Validation ref: ${validationReference}`, tag: 'inferred' }
            : null,
        ].filter((f): f is Finding => f !== null);
      }

      setResultTitle(resultTitleText);
      setAnalysis(resultAnalysis);
      setRemarks(resultRemarks);
      setLastInferenceMode(resultInferenceMode);
      setLastGenerationMode(resultGenerationMode);
      setIsMockResult(resultIsMock);
      setEvidenceTags(resultTags);
      setLastBackendError('none');
      setFindings(resultFindings);
      setStatus('results');

      addToHistory({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mode,
        analysis: resultAnalysis,
        remarks: resultRemarks,
        findings: resultFindings,
        inferenceMode: resultInferenceMode,
        generationMode: resultGenerationMode,
        isMock: resultIsMock,
        evidenceTags: resultTags,
        params: {
          profile,
          cohort,
          stimulusType: mode === 'discovery' ? stimulusType : undefined,
          valence: mode === 'therapeutics' ? valence : undefined,
          arousal: mode === 'therapeutics' ? arousal : undefined,
          modality: mode === 'therapeutics' ? modality : undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      const requestMatch = message.match(/\[([a-f0-9]{12})\]/i);
      if (requestMatch?.[1]) {
        setLastRequestId(requestMatch[1]);
      }
      setLastBackendError(message);
      setErrorKind(kind);
      setResultTitle('');
      setAnalysis('');
      setRemarks('');
      setFindings([{ text: message, tag: 'low_confidence', isError: true }]);
      setStatus('error');
    } finally {
      // A validation slip says nothing about the backend, so don't re-poll it.
      if (kind !== 'validation') await refreshHealth();
    }
  };

  return {
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
    evidenceTags,
    runHistory,
    sessionId,
    sessionTimestamp,
    handleRunAlgorithm,
    exportHistory,
  };
}
