import type { ValidationDiagnostic } from './errors.js';

export type FailureCategory = 'provider_http' | 'network' | 'timeout' | 'cancelled' | 'response_parsing' | 'validation' | 'unexpected_adapter';
export type Operation = 'request_build' | 'request_send' | 'http_response' | 'response_envelope' | 'response_json' | 'wire_conversion' | 'source_validation' | 'response_contract';
export interface ServerFailure {
  category: FailureCategory;
  operation: Operation;
  upstreamStatus?: number;
  upstreamCode?: string;
  upstreamMessage?: string;
  action?: string;
  transportCode?: string;
  exceptionType?: string;
  frames?: string[];
  validation?: ValidationDiagnostic;
}

const providerCodes = new Set(['INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'OUT_OF_RANGE', 'CANCELLED', 'UNIMPLEMENTED']);
const transportCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']);
const exceptionNames = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'AggregateError', 'AbortError', 'TimeoutError', 'ZodError']);

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

// Provider text is untrusted and can echo input, URLs, project IDs, or keys.
// Preserve only recognized technical codes and fixed message interpretations.
// Unknown free-form text is withheld rather than relying on partial redaction.
export function httpFailure(status: number, body: unknown): ServerFailure {
  const error = object(object(body).error);
  const code = typeof error.status === 'string' && providerCodes.has(error.status) ? error.status : 'UNKNOWN';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  let action = 'inspect_provider_http';
  let safeMessage = 'Provider message withheld: no safe recognized interpretation.';
  if (status === 402) {
    action = 'billing_required_stop'; safeMessage = 'Google reports depleted credits or a payment prerequisite. Do not enable billing for this test.';
  } else if (/free.tier.verification|required.*verif|project.*verif/.test(message)) {
    action = 'verify_project'; safeMessage = 'Google requires project verification before access.';
  } else if (/billing|payment|prepay|credits/.test(message)) {
    action = 'billing_required_stop'; safeMessage = 'Google reports a billing or payment prerequisite. Do not enable billing for this test.';
  } else if (code === 'FAILED_PRECONDITION') {
    action = 'account_prerequisite_stop'; safeMessage = 'Google reports an unmet project, region, or account prerequisite.';
  } else if (/api.key.*(invalid|not valid|expired)|invalid.*api.key/.test(message)) {
    action = 'check_key'; safeMessage = 'Google rejected the API key.';
  } else if (status === 429 || code === 'RESOURCE_EXHAUSTED') {
    action = 'check_free_quota'; safeMessage = /limit\s*[:=]\s*0|quota.*zero/.test(message)
      ? 'Google reports exhausted or unavailable quota with a zero limit.' : 'Google reports rate or quota exhaustion.';
  } else if (status === 404 || code === 'NOT_FOUND') {
    action = 'check_model_access'; safeMessage = 'Google could not find the configured model/resource or does not support this method for it.';
  } else if (status === 401 || status === 403) {
    action = 'check_permissions'; safeMessage = 'Google rejected authentication, permissions, region, or project access.';
  } else if (/schema|too many states|nesting|constraint/.test(message)) {
    action = 'fix_request_schema'; safeMessage = 'Google rejected the structured-output schema or its complexity.';
  } else if (status === 400) {
    action = 'fix_request'; safeMessage = 'Google rejected a request parameter or prerequisite.';
  } else if (status >= 500) {
    action = 'provider_service_failure'; safeMessage = 'Google reports an internal or unavailable service error.';
  }
  return { category: 'provider_http', operation: 'http_response', upstreamStatus: status, upstreamCode: code, upstreamMessage: safeMessage, action };
}

export function exceptionFailure(error: unknown, operation: Operation, aborted: boolean, userCancelled = false): ServerFailure {
  const value = object(error);
  const exceptionType = typeof value.name === 'string' && exceptionNames.has(value.name) ? value.name : 'Error';
  const frames = typeof value.stack === 'string' ? [...value.stack.matchAll(/\b(?:gemini|gemini-schema|validate|errors|provider-diagnostics)\.(?:ts|js):\d+:\d+/g)].slice(0, 4).map((match) => match[0]) : [];
  let current = value;
  let transportCode: string | undefined;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current.code === 'string' && transportCodes.has(current.code)) { transportCode = current.code; break; }
    current = object(current.cause);
  }
  if (aborted) return { category: userCancelled ? 'cancelled' : 'timeout', operation, exceptionType, action: userCancelled ? 'request_cancelled' : 'deadline_exceeded' };
  if (transportCode || (operation === 'request_send' && exceptionType === 'TypeError')) {
    const tls = transportCode !== undefined && /CERT|ISSUER|SELF_SIGNED|TLS/.test(transportCode);
    return { category: 'network', operation, exceptionType, ...(transportCode ? { transportCode } : {}), action: tls ? 'check_tls_trust' : 'check_network' };
  }
  return { category: 'unexpected_adapter', operation, exceptionType, frames, action: 'investigate_adapter' };
}
