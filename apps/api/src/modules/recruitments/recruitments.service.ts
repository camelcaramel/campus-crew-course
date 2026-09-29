import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRecruitmentDto } from './create-recruitment.dto';
import type { UpdateRecruitmentDto } from './update-recruitment.dto';
import type { RecruitmentListQueryDto } from './recruitment-list-query.dto';

// 사용자 전체를 include하지 않고 응답에 필요한 기본 정보만 선택합니다.
const authorInclude = { author: { select: { id: true, name: true } } };

@Injectable()
export class RecruitmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page, limit, q, category }: RecruitmentListQueryDto) {
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip) || skip > 2147483647) {
      throw new BadRequestException('페이지 범위를 초과했습니다.');
    }
    const where: Prisma.RecruitmentWhereInput = {
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
    };
    // 같은 where로 전체 수를 계산해야 필터 결과의 페이지 수가 맞습니다.
    const [items, total] = await Promise.all([
      this.prisma.recruitment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: authorInclude,
      }),
      this.prisma.recruitment.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    this.checkIdRange(id);
    const recruitment = await this.prisma.recruitment.findUnique({
      where: { id },
      include: authorInclude,
    });
    if (!recruitment) {
      throw new NotFoundException({
        code: 'RECRUITMENT_NOT_FOUND',
        message: '모집글을 찾을 수 없습니다.',
      });
    }
    return recruitment;
  }

  async create(userId: number, body: CreateRecruitmentDto) {
    try {
      return await this.prisma.recruitment.create({
        data: {
          title: body.title,
          content: body.content,
          category: body.category,
          authorId: userId,
        },
        include: authorInclude,
      });
    } catch (error) {
      // 위 조회 직후 사용자가 삭제되어도 DB의 FK가 잘못된 저장을 막습니다.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new UnauthorizedException(
          '사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.',
        );
      }
      throw error;
    }
  }

  async update(id: number, userId: number, body: UpdateRecruitmentDto) {
    await this.requireOwner(id, userId);
    try {
      return await this.prisma.recruitment.update({
        where: { id },
        // undefined 필드는 수정하지 않습니다. id/authorId/relation은 받지 않습니다.
        data: {
          title: body.title,
          content: body.content,
          category: body.category,
          status: body.status,
        },
        include: authorInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          code: 'RECRUITMENT_NOT_FOUND',
          message: '모집글을 찾을 수 없습니다.',
        });
      }
      throw error;
    }
  }

  async remove(id: number, userId: number) {
    await this.requireOwner(id, userId);
    try {
      await this.prisma.recruitment.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          code: 'RECRUITMENT_NOT_FOUND',
          message: '모집글을 찾을 수 없습니다.',
        });
      }
      throw error;
    }
  }

  // Authorization: 인증된 사용자라도 작성자 본인의 글만 변경할 수 있습니다.
  private async requireOwner(id: number, userId: number): Promise<void> {
    const recruitment = await this.findOne(id);
    if (recruitment.authorId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'RECRUITMENT_FORBIDDEN',
        message: '작성자만 수정하거나 삭제할 수 있습니다.',
      });
    }
  }

  private checkIdRange(id: number) {
    // ParseIntPipe의 숫자 변환만으로는 PostgreSQL Int 범위를 보장하지 못합니다.
    if (!Number.isInteger(id) || id < -2147483648 || id > 2147483647) {
      throw new BadRequestException('id가 DB 정수 범위를 벗어났습니다.');
    }
  }
}
