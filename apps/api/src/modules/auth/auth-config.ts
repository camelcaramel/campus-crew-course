import type { JwtModuleOptions } from '@nestjs/jwt';

export const AUTH_TOKEN_TTL_SECONDS = 60 * 60;

export function authJwtOptions(): JwtModuleOptions {
  const secret = process.env.JWT_SECRET;
  if (
    !secret ||
    secret.trim().length < 32 ||
    secret === 'replace-with-a-random-secret-at-least-32-characters'
  ) {
    throw new Error('JWT_SECRET에 32자 이상의 무작위 비밀값을 설정하세요.');
  }
  return {
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: AUTH_TOKEN_TTL_SECONDS },
    verifyOptions: { algorithms: ['HS256'] },
  };
}
