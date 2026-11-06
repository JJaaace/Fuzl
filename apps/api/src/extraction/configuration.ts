import { GEMINI_MODEL, MODEL, aiProviderSchema } from '@fuzl/planning';
import type { AIConfiguration } from '@fuzl/planning';
import { ExtractionError } from './errors.js';

export function getAIConfiguration(): AIConfiguration {
  // Preserve existing OpenAI installations; an invalid setting never falls back.
  const selected = aiProviderSchema.safeParse(process.env.AI_PROVIDER ?? 'openai');
  if (!selected.success) throw new ExtractionError(503, 'invalid_provider', 'Set AI_PROVIDER to openai or gemini in apps/api/.env and restart the API. No provider was called.');
  return selected.data === 'openai' ? { provider: 'openai', model: MODEL } : { provider: 'gemini', model: GEMINI_MODEL };
}

export function ensureAIConfigured() {
  const configuration = getAIConfiguration();
  const variable = configuration.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = process.env[variable]?.trim();
  if (process.env.AI_ENABLED !== 'true' || !apiKey) {
    throw new ExtractionError(503, 'ai_not_configured', `AI analysis is not configured for ${configuration.provider}. Set ${variable} and AI_ENABLED=true in apps/api/.env, then restart the API. Samples and manual entry still work.`);
  }
  return { ...configuration, apiKey };
}
