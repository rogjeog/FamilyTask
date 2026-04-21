let token: string | null = null;

const SESSION_KEY = 'ft_at';

export function getAccessToken(): string | null {
  if (token) return token;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(t: string): void {
  token = t;
  try {
    sessionStorage.setItem(SESSION_KEY, t);
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — memory-only fallback
  }
}

export function clearSession(): void {
  token = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
