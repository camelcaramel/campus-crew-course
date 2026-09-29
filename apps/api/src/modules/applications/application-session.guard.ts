import {
  ConflictException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthRequest } from '../../common/types/auth-user';

// 다른 탭에서 Cookie 계정이 바뀌었을 때 오래된 화면의 요청을 중단합니다.
// 이 헤더는 인증 수단이 아니며 applicantId는 여전히 JwtAuthGuard가 정합니다.
@Injectable()
export class ApplicationSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const expected = request.headers['x-expected-user-id'];
    if (expected !== undefined && expected !== String(request.user?.id)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'AUTH_SESSION_CHANGED',
        message:
          '로그인 계정이 변경되었습니다. 현재 계정으로 다시 확인해주세요.',
      });
    }
    return true;
  }
}
