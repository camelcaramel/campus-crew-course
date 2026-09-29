import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCookieAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { CreateRecruitmentDto } from './create-recruitment.dto';
import { RecruitmentsService } from './recruitments.service';
import { UpdateRecruitmentDto } from './update-recruitment.dto';
import { RecruitmentListQueryDto } from './recruitment-list-query.dto';

@ApiTags('recruitments')
@Controller('api/recruitments')
export class RecruitmentsController {
  constructor(private readonly recruitmentsService: RecruitmentsService) {}

  @Get()
  @ApiOkResponse({
    description: 'items와 meta(page, limit, total, totalPages)',
  })
  findAll(@Query() query: RecruitmentListQueryDto) {
    return this.recruitmentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.recruitmentsService.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ description: '로그인 사용자가 작성한 모집글' })
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiUnauthorizedResponse({ description: '로그인이 필요합니다.' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRecruitmentDto) {
    return this.recruitmentsService.create(user.id, body);
  }

  @Patch(':id')
  @ApiOkResponse({ description: '작성자가 수정한 모집글' })
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiUnauthorizedResponse({ description: '로그인이 필요합니다.' })
  @ApiForbiddenResponse({ description: '작성자만 수정/삭제할 수 있습니다.' })
  @ApiNotFoundResponse({ description: '모집글을 찾을 수 없습니다.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRecruitmentDto,
  ) {
    return this.recruitmentsService.update(id, user.id, body);
  }

  @Delete(':id')
  @ApiNoContentResponse({ description: '작성자가 삭제한 모집글' })
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiUnauthorizedResponse({ description: '로그인이 필요합니다.' })
  @ApiForbiddenResponse({ description: '작성자만 수정/삭제할 수 있습니다.' })
  @ApiNotFoundResponse({ description: '모집글을 찾을 수 없습니다.' })
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.recruitmentsService.remove(id, user.id);
  }
}
