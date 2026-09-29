import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AUTH_COOKIE_NAME } from './modules/auth/auth-cookie';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  // src/main.ts와 dist/src/main.js에서 모두 같은 API/저장소 .env를 찾습니다.
  const apiRoot = existsSync(resolve(__dirname, '../package.json'))
    ? resolve(__dirname, '..')
    : resolve(__dirname, '../..');
  // 프로세스 환경 변수 > apps/api/.env > 저장소 루트 .env 순으로 우선합니다.
  for (const envPath of [
    resolve(apiRoot, '.env'),
    resolve(apiRoot, '../../.env'),
  ]) {
    if (existsSync(envPath)) loadEnvFile(envPath);
  }

  const port = Number(process.env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json');
  app.use(cookieParser());
  app.useBodyParser('urlencoded', { extended: true });
  // JSON 파싱 오류의 원문에는 password가 포함될 수 있어 Nest 전달 전에 제거합니다.
  app.use(
    (
      error: unknown,
      _request: unknown,
      _response: unknown,
      next: (error: unknown) => void,
    ) => {
      if (
        error instanceof SyntaxError &&
        'type' in error &&
        error.type === 'entity.parse.failed'
      ) {
        next(new BadRequestException('올바른 JSON 요청 본문을 입력하세요.'));
        return;
      }
      next(error);
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: () =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '입력값을 확인해주세요.',
        }),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Campus Crew API')
    .setDescription(
      'Prisma 모집글 CRUD, 회원가입 및 JWT HttpOnly Cookie 로그인 실습 API입니다.',
    )
    .setVersion('1.0')
    .addCookieAuth(AUTH_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, undefined, 'Bootstrap');
  process.exitCode = 1;
});
