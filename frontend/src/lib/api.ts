import { BackendHealthResponse, StimulusType } from './types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';

export function createClientRequestId(): string {
  return `ui-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildRequestHeaders(baseHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...baseHeaders, 'X-Request-ID': createClientRequestId() };
  if (API_KEY.trim()) {
    headers['X-API-Key'] = API_KEY.trim();
  }
  return headers;
}

export function getAcceptForStimulus(type: StimulusType): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'audio') return 'audio/*';
  return '';
}

export async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    const detail = payload?.detail ?? payload?.message;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  } catch {
    // no-op
  }
  return fallback;
}

export async function fetchHealth(): Promise<{ payload: BackendHealthResponse; requestId: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/status`, {
    headers: buildRequestHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Health endpoint failed (${response.status}).`);
  }
  const payload = (await response.json()) as BackendHealthResponse;
  const requestId = response.headers.get('x-request-id') ?? 'none';
  return { payload, requestId };
}

export async function submitPredict(formData: FormData): Promise<{ data: Record<string, unknown>; requestId: string }> {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: buildRequestHeaders(),
    body: formData,
  });
  const requestId = response.headers.get('x-request-id') ?? 'none';
  if (!response.ok) {
    const detail = await parseApiError(response, 'Failed to call backend /predict endpoint.');
    throw new Error(`[${requestId}] ${detail}`);
  }
  const data = await response.json();
  return { data, requestId };
}

export async function submitGenerate(payloadData: Record<string, unknown>): Promise<{ data: Record<string, unknown>; requestId: string }> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: buildRequestHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payloadData),
  });
  const requestId = response.headers.get('x-request-id') ?? 'none';
  if (!response.ok) {
    const detail = await parseApiError(response, 'Failed to call backend /generate endpoint.');
    throw new Error(`[${requestId}] ${detail}`);
  }
  const data = await response.json();
  return { data, requestId };
}
