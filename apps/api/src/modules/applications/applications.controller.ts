import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './create-application.dto';
import { ApplicationSessionGuard } from './application-session.guard';
import { UpdateApplicationStatusDto } from './update-application-status.dto';

@ApiTags('applications')
@ApiCookieAuth()
@ApiHeader({
  name: 'X-Expected-User-Id',
  required: false,
  description:
    '화면의 사용자와 인증 Cookie 계정 일치 확인용. 인증 및 applicantId 결정에는 사용하지 않습니다.',
})
@ApiUnauthorizedResponse({ description: '로그인이 필요합니다.' })
@ApiNotFoundResponse({
  description: 'RECRUITMENT_NOT_FOUND / APPLICATION_NOT_FOUND',
})
@ApiBadRequestResponse({
  description: '올바른 id와 2~200자 지원 메시지가 필요합니다.',
})
@ApiConflictResponse({
  description: 'AUTH_SESSION_CHANGED: 화면과 Cookie 계정 불일치',
})
@UseGuards(JwtAuthGuard, ApplicationSessionGuard)
@Controller('api/recruitments/:id')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('applications')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description:
      '[{ id, message, status, createdAt, applicant: { id, name, email } }]',
  })
  @ApiForbiddenResponse({ description: 'APPLICATION_FORBIDDEN: 작성자 전용' })
  findAll(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applications.findAll(id, user.id);
  }

  @Patch('applications/:applicationId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description:
      '{ id, message, status, createdAt, applicant: { id, name, email } }',
  })
  @ApiForbiddenResponse({ description: 'APPLICATION_FORBIDDEN: 작성자 전용' })
  @ApiBadRequestResponse({
    description: 'status는 APPROVED 또는 REJECTED만 허용',
  })
  @ApiConflictResponse({
    description: 'APPLICATION_INVALID_STATUS / AUTH_SESSION_CHANGED',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateApplicationStatusDto,
  ) {
    return this.applications.updateStatus(id, applicationId, user.id, body);
  }

  @Post('applications')
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({
    description: '{ application: { id, message, status: PENDING, createdAt } }',
  })
  @ApiConflictResponse({
    description:
      'APPLICATION_SELF_NOT_ALLOWED / RECRUITMENT_CLOSED / APPLICATION_ALREADY_EXISTS / AUTH_SESSION_CHANGED',
  })
  create(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateApplicationDto,
  ) {
    return this.applications.create(id, user.id, body);
  }

  @Get('my-application')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description: '{ application: { id, message, status, createdAt } | null }',
  })
  findMine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applications.findMine(id, user.id);
  }

  @Delete('applications/me')
  @Header('Cache-Control', 'no-store')
  @HttpCode(204)
  @ApiNoContentResponse({ description: '본인의 PENDING 지원을 삭제했습니다.' })
  @ApiConflictResponse({
    description: 'APPLICATION_INVALID_STATUS / AUTH_SESSION_CHANGED',
  })
  async cancelMine(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.applications.cancelMine(id, user.id);
  }
}
