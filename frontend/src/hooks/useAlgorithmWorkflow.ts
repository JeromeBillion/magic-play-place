import { useState, useMemo } from 'react';
import { submitPredict, submitGenerate } from '../lib/api';
import {
  Mode,
  GenerationMode,
  Modality,
  StimulusType,
  NeurologicalProfile,
  AgeCohort,
  InferenceMode,
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

export function useAlgorithmWorkflow(
  refreshHealth: () => Promise<void>,
  setLastRequestId: (id: string) => void,
  setLastInferenceMode: (mode: InferenceMode) => void
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState(
    'Configure inputs, then run the algorithm to generate neural response analysis.'
  );
  const [remarks, setRemarks] = useState('Awaiting computational logic instructions...');
  const [findings, setFindings] = useState<string[]>([
    'Neural pathway correlation: pending',
    'Dopamine receptor activation: pending',
    'Prefrontal cortex engagement: pending',
  ]);
  const [lastGenerationMode, setLastGenerationMode] = useState<GenerationMode>('unknown');
  const [lastBackendError, setLastBackendError] = useState<string>('none');

  const sessionId = useMemo(
    () => `NRL-${Math.random().toString(36).slice(2, 11).toUpperCase()}`,
    []
  );
  const sessionTimestamp = useMemo(
    () => new Date().toISOString().split('.')[0],
    []
  );

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
    if (mode === 'conditioning') {
      setLastBackendError('none');
      setAnalysis(`Conditioning profile applied.\nNeurological profile: ${profile.toUpperCase()}\nAge cohort: ${cohort.toUpperCase()}`);
      setRemarks('Future discovery and therapeutics runs will be evaluated under the updated demographic substrate.');
      setFindings((prev) => [
        'CONDITIONING baseline updated',
        `Active cohort: ${profile}/${cohort}`,
        ...prev.slice(0, 3),
      ]);
      return;
    }

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

        const { data, requestId } = await submitPredict(formData);
        const insights = asRecord(data?.insights);
        setLastRequestId(requestId);
        const description =
          (typeof insights?.description === 'string' ? insights.description : null) ??
          (typeof data?.message === 'string' ? data.message : null) ??
          'Prediction complete.';
        const crossModal =
          (typeof insights?.cross_modal_guide === 'string' ? insights.cross_modal_guide : null) ??
          'No cross-modal recommendation was returned by the backend.';
        const evidenceTags = Array.isArray(data?.evidence_tags) ? data.evidence_tags.join(', ') : 'n/a';
        const disclaimer =
          typeof data?.scientific_disclaimer === 'string'
            ? data.scientific_disclaimer
            : 'Research-use output only. Not clinical advice.';

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
        const payloadData = {
          valence,
          arousal,
          modality,
          profile,
          age: mapAgeCohort(cohort),
        };

        const { data, requestId } = await submitGenerate(payloadData);
        setLastRequestId(requestId);

        const metrics = asRecord(data?.optimization_metrics) ?? asRecord(data?.simulated_optimization_metrics);
        const generationMode =
          typeof data?.generation_mode === 'string' ? data.generation_mode : 'simulation';
        const iterations = typeof data?.iterations === 'number' ? data.iterations : 'n/a';
        const generatedPayload =
          typeof data?.generated_payload === 'string' ? data.generated_payload : 'n/a';
        const validationReference =
          typeof data?.validation_reference === 'string' ? data.validation_reference : null;
        const scientificDisclaimer =
          typeof data?.scientific_disclaimer === 'string'
            ? data.scientific_disclaimer
            : 'Simulation mode only.';
        const metricSummary =
          metrics && typeof metrics === 'object'
            ? `\nBaseline distance: ${metrics.baseline_distance ?? 'n/a'}\nFinal distance: ${
                metrics.final_distance ?? 'n/a'
              }\nImprovement: ${metrics.improvement ?? 'n/a'}`
            : '';
        const validationRef = validationReference ? `\nValidation ref: ${validationReference}` : '';
        
        setAnalysis(
          `Therapeutics ${generationMode.toUpperCase()} complete.\nIterations: ${iterations}\nPayload: ${generatedPayload}${metricSummary}${validationRef}`
        );
        setRemarks(
          `${scientificDisclaimer}\n\nTarget baseline: ${profile.toUpperCase()} / ${cohort.toUpperCase()}.`
        );
        setLastInferenceMode(normalizeInferenceMode(data?.inference_mode));
        setLastGenerationMode(normalizeGenerationMode(data?.generation_mode));
        setLastBackendError('none');
        setFindings((prev) => [
          `THERAPEUTICS ${generationMode.toUpperCase()} completed`,
          `Target vectors: valence=${valence}, arousal=${arousal}, modality=${modality}`,
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

  return {
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
  };
}
