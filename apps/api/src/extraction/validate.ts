import { applyFields, editFields, providerOutputSchema } from '@fuzl/planning';
import type { AnalysisRequest, PlanningFact, PlanningSummary } from '@fuzl/planning';
import { invalidOutput, schemaFailure } from './errors.js';

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function containsNumber(quotes: string, value: number): boolean {
  return [...quotes.matchAll(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g)].some((match) => Number(match[0].replaceAll(',', '')) === value);
}
function explicitDate(date: string, quotes: string): boolean {
  if (quotes.includes(date)) return true;
  const [year, month, day] = date.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const name = months[month - 1];
  if (!name) return false;
  const pattern = `${name.slice(0, 3)}(?:${name.slice(3)})?\\.?`;
  return new RegExp(`\\b(?:${pattern}\\s+${day}(?:st|nd|rd|th)?,?\\s+${year}|${day}\\s+${pattern}\\s+${year})\\b`, 'i').test(quotes);
}

export function validateExtraction(raw: unknown, request: AnalysisRequest): { summary: PlanningSummary; warnings: string[] } {
  const parsed = providerOutputSchema.safeParse(raw);
  if (!parsed.success) schemaFailure('canonical_schema', parsed.error);
  const output = parsed.data;
  const warnings: string[] = [];
  for (const [collection, items] of [['participants', output.participants], ['speakers', output.speakers], ['sources', output.sources], ['questions', output.questions], ['facts', output.facts.map((item) => item.fact)]] as const) {
    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.id)) invalidOutput('source_validation', [collection, index, 'id'], 'duplicate_id');
      ids.add(item.id);
    }
  }
  const people = new Map(output.participants.map((person) => [person.id, person]));
  const speakers = new Map(output.speakers.map((speaker) => [speaker.id, speaker]));
  const sources = new Map(output.sources.map((source) => [source.id, source]));
  const facts = new Map(output.facts.map((item) => [item.fact.id, item.fact]));
  for (const [index, speaker] of output.speakers.entries()) {
    if (speaker.participantId !== null && !people.has(speaker.participantId)) invalidOutput('source_validation', ['speakers', index, 'participantId'], 'unknown_reference');
    if (speaker.label === 'Unknown') {
      if (speaker.participantId !== null) invalidOutput('source_validation', ['speakers', index, 'participantId'], 'unknown_speaker_has_participant');
    } else if (!new RegExp(`^\\s*${escape(speaker.label)}\\s*:`, 'm').test(request.conversation)) invalidOutput('source_validation', ['speakers', index, 'label'], 'speaker_not_in_source');
  }
  for (const [index, person] of output.participants.entries()) {
    if (person.name !== null && !output.speakers.some((speaker) => speaker.label === person.name && speaker.participantId === person.id)) invalidOutput('source_validation', ['participants', index, 'name'], 'participant_not_in_speakers');
  }
  for (const [index, source] of output.sources.entries()) {
    const speaker = speakers.get(source.speakerId);
    if (!speaker) invalidOutput('source_validation', ['sources', index, 'speakerId'], 'unknown_reference');
    if (!request.conversation.includes(source.text)) invalidOutput('source_validation', ['sources', index, 'text'], 'quote_not_exact');
    if (speaker.label !== 'Unknown' && !new RegExp(`^\\s*${escape(speaker.label)}\\s*:`).test(source.text)) invalidOutput('source_validation', ['sources', index, 'text'], 'quote_speaker_mismatch');
  }
  const summary: PlanningSummary = { ...output, facts: [], questions: output.questions.map((question) => ({ ...question, resolution: null })) };
  for (const [index, question] of summary.questions.entries()) {
    const missing = question.relatedFactIds.findIndex((id) => !facts.has(id));
    if (missing !== -1) invalidOutput('source_validation', ['questions', index, 'relatedFactIds', missing], 'unknown_reference');
  }
  for (const [index, candidate] of output.facts.entries()) {
    const fact = candidate.fact;
    const missingSource = fact.sourceIds.findIndex((id) => !sources.has(id));
    if (missingSource !== -1) invalidOutput('source_validation', ['facts', index, 'fact', 'sourceIds', missingSource], 'unknown_reference');
    const subject = fact.subject;
    if (subject.kind === 'speaker' && (!speakers.has(subject.speakerId) ||
      !fact.sourceIds.some((id) => sources.get(id)?.speakerId === subject.speakerId))) invalidOutput('source_validation', ['facts', index, 'fact', 'subject'], 'subject_evidence_mismatch');
    if (subject.kind === 'participant' && (!people.has(subject.participantId) || !fact.sourceIds.some((id) => {
      const source = sources.get(id)!;
      return speakers.get(source.speakerId)?.participantId === subject.participantId;
    }))) invalidOutput('source_validation', ['facts', index, 'fact', 'subject'], 'subject_evidence_mismatch');
    if (candidate.supersedes.some((id) => {
      const previous = facts.get(id);
      return !previous || id === fact.id || previous.kind !== fact.kind || JSON.stringify(previous.subject) !== JSON.stringify(fact.subject);
    })) invalidOutput('source_validation', ['facts', index, 'supersedes'], 'invalid_supersession');
    const quotes = fact.sourceIds.map((id) => sources.get(id)!.text).join('\n');
    if (fact.kind === 'budget') {
      if (fact.amount !== null && !containsNumber(quotes, fact.amount)) invalidOutput('source_validation', ['facts', index, 'fact', 'amount'], 'number_not_in_quote');
      if (fact.currency !== null && !quotes.includes(fact.currency) &&
        !(fact.currency === 'EUR' && quotes.includes('€')) && !(fact.currency === 'GBP' && quotes.includes('£')) &&
        !(fact.currency === 'USD' && quotes.includes('US$'))) invalidOutput('source_validation', ['facts', index, 'fact', 'currency'], 'currency_not_in_quote');
    }
    if (fact.kind === 'travel' && fact.maxMinutes !== null && !containsNumber(quotes, fact.maxMinutes)) invalidOutput('source_validation', ['facts', index, 'fact', 'maxMinutes'], 'number_not_in_quote');
    const checked: PlanningFact = { ...fact,
      // Source certainty and user confirmation are distinct. Only the editor can confirm a candidate.
      status: fact.status === 'confirmed' ? 'proposed' : fact.status,
      extraction: { reviewed: false, reportedStatus: fact.status, uncertainty: candidate.uncertainty, scope: candidate.scope, supersedes: candidate.supersedes },
    };
    if (checked.kind === 'schedule' && checked.exactDate !== null && !explicitDate(checked.exactDate, quotes)) {
      checked.exactDate = null;
      warnings.push('An exact date was removed because the supporting quote does not state it explicitly. Confirm the intended date manually.');
    }
    if (checked.kind === 'schedule') {
      for (const field of ['startTime', 'endTime'] as const) {
        const time = checked[field];
        if (time === null) continue;
        const [hour, minute] = time.split(':').map(Number);
        const meridiem = hour < 12 ? 'a' : 'p';
        const twelveHour = hour % 12 || 12;
        const stated = quotes.includes(time) || new RegExp(`\\b${twelveHour}${minute ? `:${String(minute).padStart(2, '0')}` : '(?::00)?'}\\s*${meridiem}\\.?m\\.?\\b`, 'i').test(quotes);
        if (!stated) { checked[field] = null; warnings.push('A time boundary was removed because its AM/PM or exact time is not explicit in the quoted text. Confirm it manually.'); }
      }
    }
    const fields = applyFields(checked, editFields(checked));
    if (!fields.ok) invalidOutput('field_validation', ['facts', index, 'fact', fields.field], fields.rule);
    summary.facts.push(fields.fact);
  }
  if (request.referenceDate === null && /\b(friday|saturday|sunday|monday|tuesday|wednesday|thursday|today|tomorrow|tonight|next week)\b/i.test(request.conversation)) {
    warnings.push('Relative dates need the date of the conversation and confirmation of the intended day. No current date was assumed.');
    summary.questions = [...summary.questions.slice(0, 29), {
      id: `reference-${crypto.randomUUID()}`, kind: 'missing', text: 'What date was this conversation written, and which exact day is intended?', relatedFactIds: [], resolution: null,
    }];
  }
  warnings.push('AI claims have not been reviewed. Exact quotes validate provenance, not the accuracy or completeness of the interpretation.');
  return { summary, warnings: [...new Set(warnings)] };
}
