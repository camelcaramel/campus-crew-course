import type { LoginValues } from './schema';

export type AuthResponse = {
  user: { id: number; name: string; email: string };
};

// Same-origin /api proxy: fetch 기본 credentials='same-origin'이 Cookie를 전달합니다.
export async function login(values: LoginValues): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message =
      data !== null &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message.trim()
        ? data.message
        : '로그인하지 못했습니다. 잠시 후 다시 시도해주세요.';
    throw new Error(
      response.status === 401
        ? '이메일 또는 비밀번호를 확인해주세요.'
        : message,
    );
  }
  return response.json() as Promise<AuthResponse>;
}

export async function getMe(
  signal?: AbortSignal,
): Promise<AuthResponse | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store', signal });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('로그인 상태를 확인하지 못했습니다.');
  return response.json() as Promise<AuthResponse>;
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok)
    throw new Error('로그아웃하지 못했습니다. 다시 시도해주세요.');
}
