export class ExtractionError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function invalidOutput(): never {
  throw new ExtractionError(502, 'invalid_output', 'The AI response could not be verified. Your existing summary was kept. Try a shorter conversation or enter details manually.');
}
