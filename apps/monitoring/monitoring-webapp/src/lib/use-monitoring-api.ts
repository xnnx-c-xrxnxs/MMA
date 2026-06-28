'use client';
import { useCallback } from 'react';
import { useAuth } from './auth-provider';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_MONITORING_API_URL ?? 'http://localhost:8080';

export function useMonitoringApi() {
  const { token, clearToken } = useAuth();
  const router = useRouter();

  const request = useCallback(
    async <T>(method: string, path: string): Promise<T> => {
      if (!token) {
        router.push('/auth/login');
        throw new Error('Not authenticated');
      }

      const url = `${API_BASE}/api${path}`;
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        clearToken();
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error((error as { message: string }).message ?? response.statusText);
      }

      return response.json() as Promise<T>;
    },
    [token, router, clearToken],
  );

  const get = useCallback(
    <T>(path: string) => request<T>('GET', path),
    [request],
  );

  const post = useCallback(
    <T>(path: string) => request<T>('POST', path),
    [request],
  );

  return { get, post };
}
