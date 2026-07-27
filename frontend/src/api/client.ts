import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient } from '@tanstack/react-query';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableRequest extends AxiosRequestConfig {
  _retry?: boolean;
}

function redirectToLogin(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Concurrent 401s must share a single in-flight refresh call instead of each
// firing their own /auth/refresh request.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        return data.access_token as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// The backend's global exception handlers always respond with { detail }
// and, for 422 validation errors, an additional { errors: [{field,message,type}] }.
export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Array<{ field: string; message: string }>;
}

function normalizeError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as
    | { detail?: string; errors?: Array<{ field: string; message: string }> }
    | undefined;

  if (!error.response) {
    return { message: 'Cannot connect to server. Please check your connection.', statusCode: 0 };
  }

  if (status === 422 && data?.errors) {
    return {
      message: data.detail ?? 'Please fix the errors below.',
      statusCode: 422,
      errors: data.errors,
    };
  }

  return { message: data?.detail ?? `Server error (${status})`, statusCode: status };
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as ApiError).message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (RetriableRequest & InternalAxiosRequestConfig) | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        redirectToLogin();
        return Promise.reject(normalizeError(error));
      }

      try {
        const accessToken = await refreshAccessToken(refreshToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const statusCode = (error as Partial<ApiError>)?.statusCode;
        if (statusCode && statusCode >= 400 && statusCode < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
