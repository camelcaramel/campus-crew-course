import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthRequest, AuthUser } from '../types/auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
