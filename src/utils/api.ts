import type { AuthUser, TokenPair } from '../types';

const API_BASE_URL = 'https://thiranda-813344430767.asia-southeast1.run.app';

export type ApiErrorKind = 'network' | 'auth' | 'validation' | 'http';

const STORAGE_KEYS = {
  access: 'ams.access',
  refresh: 'ams.refresh',
  user: 'ams.user'
} as const;

export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, kind: ApiErrorKind, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

/* ---------- storage helpers ---------- */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);else
    window.localStorage.setItem(key, value);
  } catch {

    /* storage unavailable — session-only */}
}

export function getAccessToken(): string | null {
  return read(STORAGE_KEYS.access);
}

export function setTokens(tokens: Partial<TokenPair>): void {
  if (tokens.access) write(STORAGE_KEYS.access, tokens.access);
  if (tokens.refresh) write(STORAGE_KEYS.refresh, tokens.refresh);
}

export function clearSession(): void {
  write(STORAGE_KEYS.access, null);
  write(STORAGE_KEYS.refresh, null);
  write(STORAGE_KEYS.user, null);
}

export function getStoredUser(): AuthUser | null {
  const raw = read(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  write(STORAGE_KEYS.user, user ? JSON.stringify(user) : null);
}

/* ---------- JWT ---------- */

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized).
      split('').
      map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`).
      join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function userFromToken(token: string, fallbackUsername: string): AuthUser {
  const payload = decodeJwt(token) ?? {};
  const username =
  typeof payload.username === 'string' && payload.username ||
  typeof payload.user === 'string' && payload.user ||
  fallbackUsername;
  const isSuperuser =
  payload.is_superuser === true ||
  payload.is_superuser === undefined && payload.is_staff === true ||
  payload.is_superuser === undefined && payload.is_staff === undefined && username.toLowerCase() === 'admin';
  return { username, is_superuser: isSuperuser };
}

/* ---------- request core ---------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

function buildErrorMessage(status: number, payload: unknown): {message: string;fieldErrors?: Record<string, string[]>;} {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const direct = record.detail ?? record.message ?? record.error;
    if (typeof direct === 'string') return { message: direct };
    const fieldErrors: Record<string, string[]> = {};
    const parts: string[] = [];
    for (const [key, value] of Object.entries(record)) {
      const messages = Array.isArray(value) ? value.map(String) : [String(value)];
      fieldErrors[key] = messages;
      parts.push(`${key.replace(/_/g, ' ')}: ${messages.join(', ')}`);
    }
    if (parts.length) return { message: parts.join(' • '), fieldErrors };
  }
  if (typeof payload === 'string' && payload.trim()) return { message: payload.slice(0, 200) };
  return { message: `Request failed with status ${status}.` };
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = read(STORAGE_KEYS.refresh);
  if (!refresh) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {access?: string;};
    if (!data.access) return false;
    setTokens({ access: data.access });
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions, retrying = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      'Unable to connect to the server right now. Check your internet connection and try again.',
      0,
      'network'
    );
  }

  if (response.status === 401 && options.auth !== false && !retrying) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
    clearSession();
    window.dispatchEvent(new CustomEvent('ams:unauthorized'));
    throw new ApiError('Your session has expired. Please sign in again.', 401, 'auth');
  }

  if (response.status === 204) return null as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const { message, fieldErrors } = buildErrorMessage(response.status, payload);
    const kind: ApiErrorKind =
    response.status === 401 || response.status === 403 ? 'auth' : response.status === 400 ? 'validation' : 'http';
    throw new ApiError(message, response.status, kind, fieldErrors);
  }

  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options);
}

/** Normalizes paginated ({results: []}) and plain-array list responses. */
export async function apiList<T>(path: string, options: RequestOptions = {}): Promise<T[]> {
  const data = await apiRequest<unknown>(path, options);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as {results?: unknown;}).results)) {
    return (data as {results: T[];}).results;
  }
  return [];
}

/* ---------- auth actions ---------- */

export async function login(username: string, password: string): Promise<AuthUser> {
  const tokens = await apiRequest<TokenPair>('/api/auth/token/', {
    method: 'POST',
    body: { username, password },
    auth: false
  });
  setTokens(tokens);
  const user = userFromToken(tokens.access, username);
  setStoredUser(user);
  return user;
}

export function logout(): void {
  clearSession();
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}