import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

// 기존 Nest 예외를 그대로 사용하고 HTTP 경계에서 공개 응답만 정규화합니다.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Express body-parser의 413/415 등은 Nest HttpException이 아닙니다.
    // 상태는 보존하되 원문(본문/인코딩 정보)은 공개하지 않습니다.
    const parserStatus =
      exception !== null &&
      typeof exception === 'object' &&
      'statusCode' in exception &&
      typeof exception.statusCode === 'number' &&
      Number.isInteger(exception.statusCode) &&
      exception.statusCode >= 400 &&
      exception.statusCode < 500
        ? exception.statusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : parserStatus;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const fields =
      typeof body === 'object' && body !== null
        ? (body as { code?: unknown; message?: unknown })
        : undefined;

    // 내부 오류의 원문/stack/DB 정보는 응답에 넣지 않습니다.
    let code = 'INTERNAL_SERVER_ERROR';
    let message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    if (statusCode < 500) {
      code =
        typeof fields?.code === 'string'
          ? fields.code
          : statusCode === 401
            ? 'AUTH_REQUIRED'
            : HttpStatus[statusCode] || 'HTTP_ERROR';
      message =
        typeof fields?.message === 'string'
          ? fields.message
          : typeof body === 'string'
            ? body
            : '요청을 처리할 수 없습니다.';
      if (statusCode === 401 && code === 'AUTH_REQUIRED') {
        message = '로그인이 필요합니다. 다시 로그인해주세요.';
      }
      if (Array.isArray(fields?.message)) {
        code = 'VALIDATION_ERROR';
        message = '입력값을 확인해주세요.';
      }
    }
    response.status(statusCode).json({ statusCode, code, message });
  }
}
