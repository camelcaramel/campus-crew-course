import type { Request } from 'express';

// Authentication이 확인한 identity만 전달합니다. passwordHash/token은 포함하지 않습니다.
export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export type AuthRequest = Request & { user?: AuthUser };
