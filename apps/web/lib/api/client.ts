import { API_BASE_URL } from '@/lib/config';
import { getAccessToken, setAccessToken, clearSession } from '@/lib/auth/session';

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Single-flight refresh ────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function executeRefresh(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, 'REFRESH_FAILED', 'Session expired');
  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
}

function getSingleFlightRefresh(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = executeRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

// Paths that must never trigger an auto-refresh attempt on 401.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/register'];

interface FetchOptions extends RequestInit {
  // Set to true on the retry after a successful refresh to prevent infinite loops
  // if the replayed request returns 401 for a different reason.
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { _retried, ...init } = options;

  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const isNoRefreshPath = NO_REFRESH_PATHS.some((p) => path.startsWith(p));

  if (res.status === 401 && !_retried && !isNoRefreshPath) {
    try {
      await getSingleFlightRefresh();
      return apiFetch<T>(path, { ...options, _retried: true });
    } catch {
      clearSession();
      window.location.href = '/login';
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired');
    }
  }

  if (!res.ok) {
    let body: { code?: string; message?: string } = {};
    try {
      body = (await res.json()) as { code?: string; message?: string };
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      res.status,
      body.code ?? 'UNKNOWN_ERROR',
      body.message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
