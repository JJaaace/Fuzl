import { answerRecordedPlan, planAnswerSchema } from '@fuzl/planning';
import type { PlanQuestionRequest } from '@fuzl/planning';
import { planningContext } from './planning-context.js';
import type { PlanningContextOptions } from './planning-context.js';
import { ExtractionError } from './errors.js';
export async function askPlan(input: PlanQuestionRequest, signal: AbortSignal, headers: {
    authorization?: string;
    origin?: string;
}, options: PlanningContextOptions = {}) {
    try {
        const owned = await planningContext(input, headers, options);
        // This intentionally has no private-spending/history parameter and no model
        // call: recorded questions need only the organizer-authorized summary.
        const result = planAnswerSchema.parse(answerRecordedPlan(input.summary, input.question, input.participantId));
        if (signal.aborted)
            throw new ExtractionError(499, 'question_cancelled', 'Question cancelled. Your plan was kept.');
        await owned.checkCurrent();
        return result;
    }
    catch (error) {
        if (error instanceof ExtractionError)
            throw error;
        throw new ExtractionError(503, 'question_unavailable', 'Could not check this saved planning context. Your work was kept; retry deliberately.');
    }
}
