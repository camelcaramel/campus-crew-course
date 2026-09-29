import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiCookieAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupResponseDto } from './signup-response.dto';
import { SignupDto } from './signup.dto';
import { LoginDto } from './login.dto';
import { AuthResponseDto, LogoutResponseDto } from './auth-response.dto';
import { AUTH_COOKIE_NAME, authCookieOptions } from './auth-cookie';
import { AUTH_TOKEN_TTL_SECONDS } from './auth-config';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: '로그인 — JWT를 HttpOnly Cookie에 저장' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호 확인 필요' })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const { user, token } = await this.authService.login(body);
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...authCookieOptions(),
      maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    });
    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Cookie JWT를 검증하고 현재 사용자 조회' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Cookie 없음, 만료 또는 유효하지 않은 인증',
  })
  me(@CurrentUser() user: AuthUser): AuthResponseDto {
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: '로그아웃 — 인증 Cookie 제거' })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@Res({ passthrough: true }) response: Response): LogoutResponseDto {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
    return { message: '로그아웃되었습니다.' };
  }

  @Post('signup')
  @ApiOperation({ summary: '회원가입 — 비밀번호를 hash로 저장' })
  @ApiCreatedResponse({ type: SignupResponseDto })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiConflictResponse({
    description: '이미 사용 중인 이메일',
    schema: {
      example: {
        statusCode: 409,
        code: 'USER_EMAIL_ALREADY_EXISTS',
        message: '이미 사용 중인 이메일입니다.',
      },
    },
  })
  signup(@Body() body: SignupDto): Promise<SignupResponseDto> {
    return this.authService.signup(body);
  }
}
