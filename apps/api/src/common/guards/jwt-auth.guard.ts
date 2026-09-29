import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';
import { AUTH_COOKIE_NAME } from '../../modules/auth/auth-cookie';
import type { AuthRequest } from '../types/auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const cookies = request.cookies as Record<string, unknown> | undefined;
    // 누락/만료/서명 오류/삭제된 사용자는 authenticate에서 401로 처리합니다.
    request.user = await this.authService.authenticate(
      cookies?.[AUTH_COOKIE_NAME],
    );
    return true;
  }
}
