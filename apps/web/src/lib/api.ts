export async function checkHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`The API returned HTTP ${response.status}. Check that it is running, then retry.`);
  }

  const body: unknown = await response.json().catch(() => {
    throw new Error('The API returned invalid JSON. Check the API and proxy configuration, then retry.');
  });

  if (typeof body !== 'object' || body === null ||
      !('status' in body) || body.status !== 'ok' ||
      !('service' in body) || body.service !== 'fuzl-api') {
    throw new Error('Unexpected API response. Check the API and proxy configuration, then retry.');
  }
}
