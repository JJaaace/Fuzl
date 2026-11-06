export const factStatuses = ['proposed', 'tentative', 'confirmed', 'conflicting'] as const;
export type FactStatus = typeof factStatuses[number];
export const strengths = ['unknown', 'firm', 'flexible'] as const;
export type Strength = typeof strengths[number];
export const factKinds = ['schedule', 'budget', 'activity', 'travel', 'preference'] as const;
export type FactKind = typeof factKinds[number];

export interface Participant { id: string; name: string | null }
export interface SpeakerMapping { id: string; label: string; participantId: string | null }
export interface SourceText { id: string; speakerId: string; text: string }
export type Subject =
  | { kind: 'group' }
  | { kind: 'unknown' }
  | { kind: 'participant'; participantId: string }
  | { kind: 'speaker'; speakerId: string };

interface FactBase {
  id: string;
  subject: Subject;
  status: FactStatus;
  strength: Strength;
  sourceIds: string[];
  extraction?: {
    reviewed: boolean;
    reportedStatus: FactStatus;
    uncertainty: string;
    scope: 'current' | 'historical' | 'unknown';
    supersedes: string[];
  };
}

// Null always means unknown. In particular, a zero budget is a known limit.
export type PlanningFact = FactBase & (
  | { kind: 'schedule'; description: string | null; exactDate: string | null; startTime: string | null; endTime: string | null }
  | { kind: 'budget'; amount: number | null; currency: string | null }
  | { kind: 'activity'; description: string | null }
  | { kind: 'travel'; maxMinutes: number | null; comparison: 'at-most' | 'under' | 'unknown'; mode: string | null }
  | { kind: 'preference'; description: string | null }
);

export interface OpenQuestion {
  id: string;
  kind: 'missing' | 'conflict';
  text: string;
  relatedFactIds: string[];
  resolution: string | null;
}

export function validateQuestion(text: string, resolved: boolean, resolution: string): string | null {
  return !text.trim() || (resolved && !resolution.trim())
    ? 'Enter the question or conflict, and add a resolution before marking it resolved.' : null;
}

export interface PlanningSummary {
  participants: Participant[];
  speakers: SpeakerMapping[];
  sources: SourceText[];
  facts: PlanningFact[];
  questions: OpenQuestion[];
}

export interface ReviewState {
  draft: string;
  review: {
    origin: 'sample' | 'manual' | 'ai';
    title: string;
    sourceDraft: string;
    summary: PlanningSummary;
  } | null;
}

export interface SampleExample {
  id: string;
  title: string;
  description: string;
  conversation: string;
  summary: PlanningSummary;
}

export function emptySummary(): PlanningSummary {
  return { participants: [], speakers: [], sources: [], facts: [], questions: [] };
}

export function loadExample(example: SampleExample): ReviewState {
  return {
    draft: example.conversation,
    review: {
      origin: 'sample', title: example.title, sourceDraft: example.conversation,
      summary: structuredClone(example.summary),
    },
  };
}

export function sourceChanged(state: ReviewState): boolean {
  return state.review !== null && state.draft !== state.review.sourceDraft;
}

export function updateDraft(state: ReviewState, draft: string): ReviewState {
  return { ...state, draft };
}

export function startManualReview(state: ReviewState): ReviewState {
  return { ...state, review: { origin: 'manual', title: 'Manual summary', sourceDraft: state.draft, summary: emptySummary() } };
}

export function subjectLabel(subject: Subject, summary: PlanningSummary): string {
  if (subject.kind === 'group') return 'Whole group';
  if (subject.kind === 'unknown') return 'Attribution unknown';
  const participantId = subject.kind === 'speaker'
    ? summary.speakers.find((speaker) => speaker.id === subject.speakerId)?.participantId
    : subject.participantId;
  return summary.participants.find((person) => person.id === participantId)?.name?.trim() || 'Participant unknown';
}

export const kindLabels: Record<FactKind, string> = {
  schedule: 'Date & time', budget: 'Budget per person', activity: 'Activity idea',
  travel: 'Travel limit', preference: 'Constraint or preference',
};

export function factValue(fact: PlanningFact): string {
  switch (fact.kind) {
    case 'budget': return `${fact.amount ?? 'Amount unknown'} · ${fact.currency ?? 'Currency unknown'}`;
    case 'travel': return `${fact.maxMinutes === null ? 'Duration unknown' : `${fact.comparison === 'under' ? 'Under' : fact.comparison === 'at-most' ? 'At most' : 'Limit type unknown:'} ${fact.maxMinutes} minutes`} · ${fact.mode ?? 'Travel mode unknown'}`;
    case 'schedule': return [fact.description ?? 'Date description unknown', fact.exactDate ?? 'Exact date unknown',
      `${fact.startTime ?? 'Start unknown'} – ${fact.endTime ?? 'End unknown'}`].join(' · ');
    default: return fact.description ?? 'Unknown';
  }
}

export function blankFact(kind: FactKind, id: string): PlanningFact {
  const base: FactBase = { id, subject: { kind: 'unknown' }, status: 'proposed', strength: 'unknown', sourceIds: [] };
  switch (kind) {
    case 'schedule': return { ...base, kind, description: null, exactDate: null, startTime: null, endTime: null };
    case 'budget': return { ...base, kind, amount: null, currency: null };
    case 'travel': return { ...base, kind, maxMinutes: null, comparison: 'unknown', mode: null };
    default: return { ...base, kind, description: null };
  }
}

// Strings belong to the editor until Apply changes validates and converts them.
export interface FactFields {
  description: string;
  exactDate: string;
  startTime: string;
  endTime: string;
  amount: string;
  currency: string;
  maxMinutes: string;
  mode: string;
}

export function editFields(fact: PlanningFact): FactFields {
  return {
    description: 'description' in fact ? fact.description ?? '' : '',
    exactDate: fact.kind === 'schedule' ? fact.exactDate ?? '' : '',
    startTime: fact.kind === 'schedule' ? fact.startTime ?? '' : '',
    endTime: fact.kind === 'schedule' ? fact.endTime ?? '' : '',
    amount: fact.kind === 'budget' ? String(fact.amount ?? '') : '',
    currency: fact.kind === 'budget' ? fact.currency ?? '' : '',
    maxMinutes: fact.kind === 'travel' ? String(fact.maxMinutes ?? '') : '',
    mode: fact.kind === 'travel' ? fact.mode ?? '' : '',
  };
}

export function applyFields(fact: PlanningFact, fields: FactFields):
  { ok: true; fact: PlanningFact } | { ok: false; error: string } {
  const optional = (value: string) => value.trim() || null;
  switch (fact.kind) {
    case 'budget': {
      const amount = optional(fields.amount);
      const currency = optional(fields.currency)?.toUpperCase() ?? null;
      if (amount !== null && (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) > Number.MAX_SAFE_INTEGER / 100)) {
        return { ok: false, error: 'Enter a non-negative amount with up to two decimal places, or leave it blank for unknown.' };
      }
      if (currency !== null && !/^[A-Z]{3}$/.test(currency)) {
        return { ok: false, error: 'Use a three-letter currency code, such as USD, or leave it blank for unknown.' };
      }
      return { ok: true, fact: { ...fact, amount: amount === null ? null : Number(amount), currency } };
    }
    case 'travel': {
      const minutes = optional(fields.maxMinutes);
      if (minutes !== null && (!/^\d+$/.test(minutes) || !Number.isSafeInteger(Number(minutes)))) {
        return { ok: false, error: 'Enter a non-negative whole number of minutes, or leave it blank for unknown.' };
      }
      return { ok: true, fact: { ...fact, maxMinutes: minutes === null ? null : Number(minutes), mode: optional(fields.mode) } };
    }
    case 'schedule': {
      const exactDate = optional(fields.exactDate);
      const startTime = optional(fields.startTime);
      const endTime = optional(fields.endTime);
      if (exactDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(exactDate) ||
        !Number.isFinite(Date.parse(exactDate)) || new Date(exactDate).toISOString().slice(0, 10) !== exactDate)) {
        return { ok: false, error: 'Enter a valid exact date in YYYY-MM-DD format, or leave it unknown.' };
      }
      if ([startTime, endTime].some((time) => time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
        return { ok: false, error: 'Use 24-hour times in HH:MM format, or leave them unknown.' };
      }
      if (startTime !== null && endTime !== null && endTime <= startTime) {
        return { ok: false, error: 'End time must follow start time on the same day. For overnight plans, use separate date & time facts.' };
      }
      return { ok: true, fact: { ...fact, description: optional(fields.description), exactDate, startTime, endTime } };
    }
    default: return { ok: true, fact: { ...fact, description: optional(fields.description) } };
  }
}
