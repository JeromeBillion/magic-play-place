/**
 * The plain-spoken voice of the redesign.
 *
 * Everything the user reads is defined here; everything the backend receives
 * keeps its original value. `Mode` is still 'discovery' | 'therapeutics' |
 * 'conditioning' on the wire — only the label changes.
 */
import type {
  AgeCohort,
  Mode,
  Modality,
  NeurologicalProfile,
  StimulusType,
} from './types';

export const MODES: Mode[] = ['discovery', 'therapeutics', 'conditioning'];

export const MODE_LABELS: Record<Mode, string> = {
  discovery: 'Explore',
  therapeutics: 'Shape',
  conditioning: 'Tune',
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  discovery:
    'Show the model a sentence, a picture, a clip or a sound — it predicts how a brain might respond, and tells you how sure it is.',
  therapeutics:
    'Pick a feeling to aim for. We simulate an intervention that gently nudges toward it — simulation only, always labelled.',
  conditioning:
    'Tell us who we are modelling for. Every future run starts from this profile.',
};

export const MODE_HEADINGS: Record<Mode, string> = {
  discovery: 'Ask the model something.',
  therapeutics: 'Aim for a feeling.',
  conditioning: 'Who are we modelling?',
};

export const RUN_LABELS: Record<Mode, string> = {
  discovery: 'Run it',
  therapeutics: 'Simulate it',
  conditioning: 'Save profile',
};

export const RUNNING_LABEL = 'Reading the stars…';

export const STIMULUS_TYPES: StimulusType[] = ['text', 'image', 'video', 'audio'];

export const STIMULUS_LABELS: Record<StimulusType, string> = {
  text: 'words',
  image: 'a picture',
  video: 'a clip',
  audio: 'a sound',
};

export const MODALITIES: Modality[] = ['audio', 'text', 'image', 'video'];

export const MODALITY_LABELS: Record<Modality, string> = {
  audio: 'sound',
  text: 'words',
  image: 'a picture',
  video: 'video',
};

export const PROFILES: NeurologicalProfile[] = ['neurotypical', 'adhd', 'asd'];

export const PROFILE_LABELS: Record<NeurologicalProfile, string> = {
  neurotypical: 'Neurotypical',
  adhd: 'ADHD',
  asd: 'Autistic',
};

export const PROFILE_DESCRIPTIONS: Record<NeurologicalProfile, string> = {
  neurotypical: 'the standard baseline',
  adhd: 'attention-divergent',
  asd: 'autism spectrum',
};

export const COHORTS: AgeCohort[] = ['youth', 'adult', 'elderly'];

export const COHORT_LABELS: Record<AgeCohort, string> = {
  youth: 'young',
  adult: 'adult',
  elderly: 'older',
};

/**
 * How much to trust a finding. The backend still emits `observed`,
 * `inferred`, `hypothesis` and `low_confidence`; these are the words we show.
 */
export type TagTone = 'tag-accent-2' | 'tag-accent' | 'tag-neutral' | 'tag-outline';

export type EvidenceLabel = { label: string; tone: TagTone };

const EVIDENCE: Record<string, EvidenceLabel> = {
  observed: { label: 'measured', tone: 'tag-accent-2' },
  inferred: { label: 'reasoned', tone: 'tag-accent' },
  hypothesis: { label: 'a hunch', tone: 'tag-neutral' },
  low_confidence: { label: 'take lightly', tone: 'tag-outline' },
};

/** The four labels, in trust order — used for the legend on empty states. */
export const EVIDENCE_LEGEND: EvidenceLabel[] = [
  EVIDENCE.observed,
  EVIDENCE.inferred,
  EVIDENCE.hypothesis,
  EVIDENCE.low_confidence,
];

/** Unknown tags pass through unchanged rather than being swallowed. */
export function evidenceLabel(tag: string): EvidenceLabel {
  return EVIDENCE[tag] ?? { label: tag.replace(/_/g, ' '), tone: 'tag-neutral' };
}

/** Copy for the sky canvas, which narrates whatever the app is doing. */
export const CANVAS_COPY: Record<
  'idle' | 'loading' | 'results' | 'error',
  { title: string; sub: string }
> = {
  idle: {
    title: 'Your results will appear here, star by star.',
    sub: 'Run something on the left to add the first star.',
  },
  loading: {
    title: 'Reading the stars…',
    sub: 'This usually takes a moment.',
  },
  results: {
    title: 'Done — see fresh sightings below.',
    sub: 'Each sighting is labelled with how much to trust it.',
  },
  error: {
    title: 'We can’t reach the model right now.',
    sub: 'It’s not you — the backend isn’t answering.',
  },
};

export const DISCLAIMER = 'Research only — never medical advice.';

export const MOCK_NOTICE =
  'Heads up — this run used the mock model, so numbers are stand-ins.';
