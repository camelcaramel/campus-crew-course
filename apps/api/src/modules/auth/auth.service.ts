import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SignupDto } from './signup.dto';
import type { AuthUser } from '../../common/types/auth-user';
import type { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(body: LoginDto) {
    const account = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    if (!account || !(await compare(body.password, account.passwordHash))) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호를 확인해주세요.',
      });
    }
    const user = { id: account.id, name: account.name, email: account.email };
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user, token };
  }

  // auth/me와 모집글 Guard가 이 검증을 공유합니다. decode만으로 인증하지 않습니다.
  async authenticate(token: unknown): Promise<AuthUser> {
    if (typeof token !== 'string' || !token) throw new UnauthorizedException();
    let payload: { sub?: unknown; email?: unknown; exp?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token);
      if (
        !payload ||
        typeof payload.sub !== 'number' ||
        !Number.isSafeInteger(payload.sub) ||
        payload.sub <= 0 ||
        payload.sub > 2147483647 ||
        typeof payload.email !== 'string' ||
        !payload.email ||
        typeof payload.exp !== 'number'
      ) {
        throw new UnauthorizedException();
      }
    } catch {
      throw new UnauthorizedException();
    }
    // DB 오류는 인증 실패로 숨기지 않습니다. 사용자 정보는 항상 DB에서 조회합니다.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub as number },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async signup(body: SignupDto) {
    // 숫자 cost를 전달하면 bcryptjs가 매번 새로운 salt를 생성합니다.
    const passwordHash = await hash(body.password, 10);
    try {
      return await this.prisma.user.create({
        data: { name: body.name, email: body.email, passwordHash },
        select: { id: true, email: true, name: true, createdAt: true },
      });
    } catch (error) {
      // 사전 조회만으로는 동시 가입을 막지 못하므로 DB unique 오류를 처리합니다.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: 'USER_EMAIL_ALREADY_EXISTS',
          message: '이미 사용 중인 이메일입니다.',
        });
      }
      throw error;
    }
  }
}
