import { auth } from '../firebaseConfig';

export function getApiBaseUrl(): string {
  const rawValue = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  if (!rawValue) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is missing. Set EXPO_PUBLIC_API_URL in your environment, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.7:5000"
    );
  }
  return rawValue.replace(/\/+$/, "");
}

// Helper that attaches Firebase ID token (if present) and default headers
export async function authFetch(input: string, init: RequestInit = {}) {
  const apiBase = getApiBaseUrl();
  const url = input.startsWith('http') ? input : `${apiBase.replace(/\/$/, '')}${input.startsWith('/') ? '' : '/'}${input}`;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  };

  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore token errors; proceed without auth header
    console.warn('authFetch: failed to attach token', e);
  }

  const opts: RequestInit = {
    ...init,
    headers,
  };

  return fetch(url, opts);
}
