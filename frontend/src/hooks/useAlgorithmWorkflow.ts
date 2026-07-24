import { useState, useMemo, useCallback } from 'react';
import { submitPredict, submitGenerate } from '../lib/api';
import {
  Mode,
  GenerationMode,
  Modality,
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

const MAX_HISTORY = 8;

export function useAlgorithmWorkflow(
  refreshHealth: () => Promise<void>,
  setLastRequestId: (id: string) => void,
  setLastInferenceMode: (mode: InferenceMode) => void
) {
  const [isProcessing, setIsProcessing] = useState(false);
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
  const [isMockResult, setIsMockResult] = useState(false);
  const [evidenceTags, setEvidenceTags] = useState<string[]>([]);
  const [runHistory, setRunHistory] = useState<RunResult[]>([]);

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
    // UX6: Conditioning is instant — no fake processing
    if (mode === 'conditioning') {
      const condAnalysis = `Conditioning profile applied.\nNeurological profile: ${profile.toUpperCase()}\nAge cohort: ${cohort.toUpperCase()}`;
      const condRemarks = 'Future discovery and therapeutics runs will be evaluated under the updated demographic substrate.';
      const condFindings = [
        'CONDITIONING baseline updated',
        `Active cohort: ${profile}/${cohort}`,
      ];
      setLastBackendError('none');
      setAnalysis(condAnalysis);
      setRemarks(condRemarks);
      setIsMockResult(false);
      setEvidenceTags([]);
      setFindings((prev) => [...condFindings, ...prev.slice(0, 3)]);
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

    setIsProcessing(true);

    try {
      let resultAnalysis = '';
      let resultRemarks = '';
      let resultFindings: string[] = [];
      let resultInferenceMode: InferenceMode = 'unknown';
      let resultGenerationMode: GenerationMode = 'unknown';
      let resultIsMock = false;
      let resultTags: string[] = [];

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
        const tags = Array.isArray(data?.evidence_tags) ? data.evidence_tags.map(String) : [];
        const disclaimer =
          typeof data?.scientific_disclaimer === 'string'
            ? data.scientific_disclaimer
            : 'Research-use output only. Not clinical advice.';
        const mockFlag = data?.mock_data === true || (typeof insights?.mock_data === 'boolean' && insights.mock_data);

        resultAnalysis = description;
        resultRemarks = `${crossModal}\n\nDisclaimer: ${disclaimer}`;
        resultInferenceMode = normalizeInferenceMode(data?.inference_mode);
        resultIsMock = !!mockFlag;
        resultTags = tags;
        resultFindings = [
          `DISCOVERY completed (${stimulusType.toUpperCase()})`,
          `Output shape: ${data?.timesteps ?? 'n/a'} timesteps × ${data?.vertices ?? 'n/a'} vertices`,
          `Evidence tags: ${tags.length > 0 ? tags.join(', ') : 'n/a'}`,
        ];

        setAnalysis(resultAnalysis);
        setRemarks(resultRemarks);
        setLastInferenceMode(resultInferenceMode);
        setIsMockResult(resultIsMock);
        setEvidenceTags(resultTags);
        setLastBackendError('none');
        setFindings((prev) => [...resultFindings, ...prev.slice(0, 3)]);
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
        const loopType = typeof data?.loop_type === 'string' ? data.loop_type : 'simulation';
        const metricSummary =
          metrics && typeof metrics === 'object'
            ? `\nBaseline distance: ${metrics.baseline_distance ?? 'n/a'}\nFinal distance: ${
                metrics.final_distance ?? 'n/a'
              }\nImprovement: ${metrics.improvement ?? 'n/a'}`
            : '';
        const validationRef = validationReference ? `\nValidation ref: ${validationReference}` : '';
        
        resultAnalysis = `Therapeutics ${generationMode.toUpperCase()} complete.\nIterations: ${iterations}\nPayload: ${generatedPayload}${metricSummary}${validationRef}`;
        resultRemarks = `${scientificDisclaimer}\n\nTarget baseline: ${profile.toUpperCase()} / ${cohort.toUpperCase()}.`;
        resultInferenceMode = normalizeInferenceMode(data?.inference_mode);
        resultGenerationMode = normalizeGenerationMode(data?.generation_mode);
        resultIsMock = loopType === 'simulation';
        resultTags = [];
        resultFindings = [
          `THERAPEUTICS ${generationMode.toUpperCase()} completed`,
          `Target vectors: valence=${valence}, arousal=${arousal}, modality=${modality}`,
        ];

        setAnalysis(resultAnalysis);
        setRemarks(resultRemarks);
        setLastInferenceMode(resultInferenceMode);
        setLastGenerationMode(resultGenerationMode);
        setIsMockResult(resultIsMock);
        setEvidenceTags(resultTags);
        setLastBackendError('none');
        setFindings((prev) => [...resultFindings, ...prev.slice(0, 3)]);
      }

      // Add to history
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
      setIsProcessing(false);
      await refreshHealth();
    }
  };

  return {
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
  };
}
