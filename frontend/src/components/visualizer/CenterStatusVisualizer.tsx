'use client';

import { Constellation } from '../ui/Constellation';
import { Tag } from '../ui/Tag';
import { COHORT_LABELS, PROFILE_LABELS } from '../../lib/copy';
import type {
  AgeCohort,
  BackendReachability,
  NeurologicalProfile,
  RunStatus,
} from '../../lib/types';

const CAPTIONS: Record<RunStatus, string> = {
  idle: 'Ready when you are — results appear on the right.',
  loading: 'Listening to the model…',
  results: 'Done — fresh findings on the right.',
  error: 'We couldn’t reach the model. Details on the right.',
};

const STATUS_WORD: Record<RunStatus, string> = {
  idle: 'ready',
  loading: 'thinking…',
  results: 'done',
  error: 'offline',
};

type Props = {
  profile: NeurologicalProfile;
  cohort: AgeCohort;
  status: RunStatus;
  /** Distinguishes "you haven't filled this in" from "the backend is down". */
  errorKind?: 'validation' | 'backend';
  backendReachability: BackendReachability;
};

export function CenterStatusVisualizer({
  profile,
  cohort,
  status,
  errorKind = 'backend',
  backendReachability,
}: Props) {
  const isOffline = backendReachability === 'offline';
  const isLoading = status === 'loading';
  const needsInput = status === 'error' && errorKind === 'validation';

  const statusWord = needsInput ? 'needs input' : STATUS_WORD[status];
  const caption = needsInput
    ? 'Nothing to run yet — see the note on the right.'
    : CAPTIONS[status];

  return (
    <div className="flex flex-col items-center gap-6 py-3">
      <div className="flex flex-wrap justify-center gap-2">
        <Tag tone={isOffline ? 'tag-accent' : 'tag-accent-2'}>
          <span
            className="size-[7px] rounded-full"
            style={{
              background: isOffline ? 'var(--color-accent-600)' : 'var(--color-sage-600)',
            }}
            aria-hidden="true"
          />
          Tribe v2 · {isOffline ? 'unreachable' : backendReachability === 'checking' ? 'checking' : 'connected'}
        </Tag>
        <Tag tone="tag-neutral">
          {PROFILE_LABELS[profile]} · {COHORT_LABELS[cohort]}
        </Tag>
        <Tag tone={status === 'results' ? 'tag-accent-2' : status === 'idle' ? 'tag-outline' : 'tag-accent'}>
          {statusWord}
        </Tag>
      </div>

      <div
        className="flex aspect-square w-full max-w-[350px] items-center justify-center rounded-full bg-sage-100"
        role="img"
        aria-label={`Model status: ${statusWord}`}
      >
        <Constellation active={isLoading} className="w-[67%] drift" />
      </div>

      {isLoading ? (
        <div className="progress w-[220px]" role="progressbar" aria-label="Running">
          <span />
        </div>
      ) : null}

      <p className="text-muted max-w-[300px] text-center text-[14px]">{caption}</p>
    </div>
  );
}
