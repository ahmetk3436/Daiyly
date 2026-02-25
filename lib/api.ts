import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import * as Sentry from '@sentry/react-native';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './storage';

const APP_ID = 'daiyly';

// Protected app routes: /api/p/...
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://89.47.113.196:8099/api/p';

// Auth/public routes: /api/... (strip /p suffix if present)
const AUTH_BASE_URL = API_BASE_URL.endsWith('/p')
  ? API_BASE_URL.slice(0, -2)
  : API_BASE_URL;

// Simple event emitter for auth expiration events
type AuthExpiredCallback = () => void;
const authExpiredListeners = new Set<AuthExpiredCallback>();

export function onAuthExpired(callback: AuthExpiredCallback): () => void {
  authExpiredListeners.add(callback);
  return () => authExpiredListeners.delete(callback);
}

function emitAuthExpired(): void {
  authExpiredListeners.forEach((cb) => cb());
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-ID': APP_ID,
  },
});

// Separate instance for auth/public endpoints (/api/auth/..., /api/health, etc.)
export const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-ID': APP_ID,
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-App-ID': APP_ID,
          },
        });

        await setTokens(data.access_token, data.refresh_token);
        processQueue(null, data.access_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearTokens();
        emitAuthExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    Sentry.captureException(error, {
      tags: {
        endpoint: error.config?.url,
        status: String(error.response?.status ?? 'unknown'),
      },
    });

    return Promise.reject(error);
  }
);

export default api;

// ─── Remote Config: api_base_url override ───────────────────────────────────
// On startup, fetches api_base_url from remote config. If set, updates axios
// instances so ALL subsequent requests go to the new URL — no rebuild needed.
// Bootstrap URL (above) is still used for the initial config fetch itself.
import AsyncStorage from '@react-native-async-storage/async-storage';

const _CACHED_URL_KEY = '@fams_api_base_url';

// Force update: min_app_version from remote config
let _remoteMinVersion: string | null = null;

export function getRemoteMinVersion(): string | null {
  return _remoteMinVersion;
}

// Restore cached URL immediately (runs async; first requests use hardcoded URL)
AsyncStorage.getItem(_CACHED_URL_KEY).then((cached) => {
  if (!cached) return;
  _applyApiUrl(cached);
}).catch(() => {});

function _applyApiUrl(base: string): void {
  // base is the raw URL without /api or /p suffix, e.g. "http://host:port"
  const stripped = base.replace(/\/api(\/p)?$/, '');
  const protectedBase = stripped + '/api/p';
  const publicBase = stripped + '/api';
  api.defaults.baseURL = protectedBase;
  authApi.defaults.baseURL = publicBase;
}

/** Call once at app startup (fire-and-forget). Updates API URL from remote config. */
export async function refreshApiBaseUrl(): Promise<void> {
  try {
    const res = await fetch(authApi.defaults.baseURL + '/config', {
      headers: { 'X-App-ID': APP_ID, 'Accept': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json() as Record<string, unknown>;
    const minVer = data?.min_app_version as string | undefined;
    if (minVer && typeof minVer === 'string') {
      _remoteMinVersion = minVer;
    }
    const remoteUrl = data?.api_base_url as string | undefined;
    if (!remoteUrl || typeof remoteUrl !== 'string') return;
    _applyApiUrl(remoteUrl);
    await AsyncStorage.setItem(_CACHED_URL_KEY, remoteUrl);
  } catch {
    // Silent — hardcoded bootstrap URL is used as fallback
  }
}
// ─────────────────────────────────────────────────────────────────────────────