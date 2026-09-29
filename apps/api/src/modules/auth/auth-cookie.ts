import type { CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'access_token';

// clearCookie도 동일한 name/path/options를 사용하며 maxAge는 전달하지 않습니다.
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}
