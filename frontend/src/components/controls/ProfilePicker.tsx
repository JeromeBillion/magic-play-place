'use client';

import { Chip, ChipGroup } from '../ui/Chip';
import {
  COHORTS,
  COHORT_LABELS,
  PROFILES,
  PROFILE_DESCRIPTIONS,
  PROFILE_LABELS,
} from '../../lib/copy';
import type { AgeCohort, NeurologicalProfile } from '../../lib/types';

/** Tune: who are we modelling, and how old are they? */
export function ProfileChoices({
  profile,
  setProfile,
  /** Stacked reads better in a narrow rail; inline suits a centred card. */
  stacked = true,
}: {
  profile: NeurologicalProfile;
  setProfile: (p: NeurologicalProfile) => void;
  stacked?: boolean;
}) {
  return (
    <ChipGroup label="Who are we modelling?" className={stacked ? 'flex-col' : ''}>
      {PROFILES.map((p) => (
        <Chip
          key={p}
          selected={profile === p}
          onSelect={() => setProfile(p)}
          label={PROFILE_LABELS[p]}
          hint={PROFILE_DESCRIPTIONS[p]}
          ariaLabel={`${PROFILE_LABELS[p]} — ${PROFILE_DESCRIPTIONS[p]}`}
          className={stacked ? 'w-full justify-between' : ''}
        />
      ))}
    </ChipGroup>
  );
}

export function CohortChoices({
  cohort,
  setCohort,
}: {
  cohort: AgeCohort;
  setCohort: (c: AgeCohort) => void;
}) {
  return (
    <ChipGroup label="Their age">
      {COHORTS.map((c) => (
        <Chip
          key={c}
          selected={cohort === c}
          onSelect={() => setCohort(c)}
          label={COHORT_LABELS[c]}
          ariaLabel={`Age cohort: ${c}`}
          className="flex-1 justify-center"
        />
      ))}
    </ChipGroup>
  );
}
