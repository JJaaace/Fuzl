import { applyFields, editFields, providerOutputSchema } from '@fuzl/planning';
import type { AnalysisRequest, PlanningFact, PlanningSummary } from '@fuzl/planning';
import { invalidOutput } from './errors.js';

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
  if (!parsed.success) invalidOutput();
  const output = parsed.data;
  const warnings: string[] = [];
  for (const items of [output.participants, output.speakers, output.sources, output.questions, output.facts.map((item) => item.fact)]) {
    if (new Set(items.map((item) => item.id)).size !== items.length) invalidOutput();
  }
  const people = new Map(output.participants.map((person) => [person.id, person]));
  const speakers = new Map(output.speakers.map((speaker) => [speaker.id, speaker]));
  const sources = new Map(output.sources.map((source) => [source.id, source]));
  const facts = new Map(output.facts.map((item) => [item.fact.id, item.fact]));
  for (const speaker of output.speakers) {
    if (speaker.participantId !== null && !people.has(speaker.participantId)) invalidOutput();
    if (speaker.label === 'Unknown') {
      if (speaker.participantId !== null) invalidOutput();
    } else if (!new RegExp(`^\\s*${escape(speaker.label)}\\s*:`, 'm').test(request.conversation)) invalidOutput();
  }
  for (const person of output.participants) {
    if (person.name !== null && !output.speakers.some((speaker) => speaker.label === person.name && speaker.participantId === person.id)) invalidOutput();
  }
  for (const source of output.sources) {
    const speaker = speakers.get(source.speakerId);
    if (!speaker || !request.conversation.includes(source.text)) invalidOutput();
    if (speaker.label !== 'Unknown' && !new RegExp(`^\\s*${escape(speaker.label)}\\s*:`).test(source.text)) invalidOutput();
  }
  const summary: PlanningSummary = { ...output, facts: [], questions: output.questions.map((question) => ({ ...question, resolution: null })) };
  for (const question of summary.questions) {
    if (question.relatedFactIds.some((id) => !facts.has(id))) invalidOutput();
  }
  for (const candidate of output.facts) {
    const fact = candidate.fact;
    if (fact.sourceIds.some((id) => !sources.has(id))) invalidOutput();
    const subject = fact.subject;
    if (subject.kind === 'speaker' && (!speakers.has(subject.speakerId) ||
      !fact.sourceIds.some((id) => sources.get(id)?.speakerId === subject.speakerId))) invalidOutput();
    if (subject.kind === 'participant' && (!people.has(subject.participantId) || !fact.sourceIds.some((id) => {
      const source = sources.get(id)!;
      return speakers.get(source.speakerId)?.participantId === subject.participantId;
    }))) invalidOutput();
    if (candidate.supersedes.some((id) => {
      const previous = facts.get(id);
      return !previous || id === fact.id || previous.kind !== fact.kind || JSON.stringify(previous.subject) !== JSON.stringify(fact.subject);
    })) invalidOutput();
    const quotes = fact.sourceIds.map((id) => sources.get(id)!.text).join('\n');
    if (fact.kind === 'budget') {
      if (fact.amount !== null && !containsNumber(quotes, fact.amount)) invalidOutput();
      if (fact.currency !== null && !quotes.includes(fact.currency) &&
        !(fact.currency === 'EUR' && quotes.includes('€')) && !(fact.currency === 'GBP' && quotes.includes('£')) &&
        !(fact.currency === 'USD' && quotes.includes('US$'))) invalidOutput();
    }
    if (fact.kind === 'travel' && fact.maxMinutes !== null && !containsNumber(quotes, fact.maxMinutes)) invalidOutput();
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
    if (!fields.ok) invalidOutput();
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
