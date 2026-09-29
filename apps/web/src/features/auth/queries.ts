'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, login, logout, type AuthResponse } from './api';

export const authMeKey = ['auth', 'me'] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: authMeKey,
    queryFn: ({ signal }) => getMe(signal),
    retry: false,
  });
}

export function useLoginMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      // 이전 me 응답이 새 로그인 상태를 덮어쓰지 않도록 먼저 취소합니다.
      await client.cancelQueries({ queryKey: authMeKey });
      client.setQueryData<AuthResponse | null>(authMeKey, data);
    },
  });
}

export function useLogoutMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: authMeKey });
      client.setQueryData<AuthResponse | null>(authMeKey, null);
    },
  });
}
