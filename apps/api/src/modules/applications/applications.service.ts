import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateApplicationDto } from './create-application.dto';
import type { UpdateApplicationStatusDto } from './update-application-status.dto';

const applicationSelect = {
  id: true,
  message: true,
  status: true,
  createdAt: true,
} as const;

// 관계 전체를 include하지 않아 passwordHash 등 비공개 필드가 나가지 않습니다.
const managedApplicationSelect = {
  ...applicationSelect,
  applicant: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(recruitmentId: number, userId: number) {
    await this.requireOwner(recruitmentId, userId);
    return this.prisma.application.findMany({
      where: { recruitmentId },
      select: managedApplicationSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async updateStatus(
    recruitmentId: number,
    applicationId: number,
    userId: number,
    body: UpdateApplicationStatusDto,
  ) {
    await this.requireOwner(recruitmentId, userId);
    if (
      !Number.isInteger(applicationId) ||
      applicationId < -2147483648 ||
      applicationId > 2147483647
    ) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_APPLICATION_ID',
        message: 'applicationId가 DB 정수 범위를 벗어났습니다.',
      });
    }
    const where = { id: applicationId, recruitmentId };
    const application = await this.prisma.application.findFirst({
      where,
      select: applicationSelect,
    });
    if (!application) throw this.notFound();
    if (application.status !== 'PENDING') throw this.invalidStatus();
    try {
      // 선조회 후 다른 요청이 승인/거절하거나 취소해도 PENDING만 변경합니다.
      return await this.prisma.application.update({
        where: { ...where, status: 'PENDING' },
        data: { status: body.status },
        select: managedApplicationSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        const remaining = await this.prisma.application.findFirst({
          where,
          select: { id: true },
        });
        if (!remaining) throw this.notFound();
        throw this.invalidStatus();
      }
      throw error;
    }
  }

  private async requireOwner(recruitmentId: number, userId: number) {
    const recruitment = await this.requireRecruitment(recruitmentId);
    if (recruitment.authorId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'APPLICATION_FORBIDDEN',
        message: '모집글 작성자만 지원자를 관리할 수 있습니다.',
      });
    }
  }

  async create(
    recruitmentId: number,
    userId: number,
    body: CreateApplicationDto,
  ) {
    const recruitment = await this.requireRecruitment(recruitmentId);
    if (recruitment.authorId === userId) {
      throw new ConflictException({
        statusCode: 409,
        code: 'APPLICATION_SELF_NOT_ALLOWED',
        message: '자신의 모집글에는 지원할 수 없습니다.',
      });
    }
    if (recruitment.status === 'CLOSED') {
      throw new ConflictException({
        statusCode: 409,
        code: 'RECRUITMENT_CLOSED',
        message: '마감된 모집글에는 지원할 수 없습니다.',
      });
    }
    if (await this.lookup(recruitmentId, userId)) throw this.duplicate();
    try {
      const application = await this.prisma.application.create({
        // applicantId는 body가 아닌 인증된 사용자에서, status는 DB 기본값에서 가져옵니다.
        data: { message: body.message, applicantId: userId, recruitmentId },
        select: applicationSelect,
      });
      return { application };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // 선검사를 동시에 통과한 요청도 DB unique가 마지막으로 막습니다.
        if (error.code === 'P2002') throw this.duplicate();
        if (error.code === 'P2003') {
          await this.requireRecruitment(recruitmentId);
          throw new UnauthorizedException({
            statusCode: 401,
            code: 'AUTH_REQUIRED',
            message: '다시 로그인해주세요.',
          });
        }
      }
      throw error;
    }
  }

  async findMine(recruitmentId: number, userId: number) {
    await this.requireRecruitment(recruitmentId);
    return { application: await this.lookup(recruitmentId, userId) };
  }

  async cancelMine(recruitmentId: number, userId: number): Promise<void> {
    await this.requireRecruitment(recruitmentId);
    const application = await this.lookup(recruitmentId, userId);
    if (!application) throw this.notFound();
    if (application.status !== 'PENDING') throw this.invalidStatus();
    // 다음 차시의 승인/거절과 경합해도 삭제 시점에 PENDING인 row만 취소합니다.
    const deleted = await this.prisma.application.deleteMany({
      where: { id: application.id, applicantId: userId, status: 'PENDING' },
    });
    if (deleted.count === 0) {
      const remaining = await this.prisma.application.findUnique({
        where: { id: application.id },
        select: applicationSelect,
      });
      if (!remaining) throw this.notFound();
      throw this.invalidStatus();
    }
  }

  private lookup(recruitmentId: number, userId: number) {
    return this.prisma.application.findUnique({
      where: {
        applicantId_recruitmentId: { applicantId: userId, recruitmentId },
      },
      select: applicationSelect,
    });
  }

  private async requireRecruitment(id: number) {
    if (!Number.isInteger(id) || id < -2147483648 || id > 2147483647) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_RECRUITMENT_ID',
        message: 'id가 DB 정수 범위를 벗어났습니다.',
      });
    }
    const recruitment = await this.prisma.recruitment.findUnique({
      where: { id },
    });
    if (!recruitment)
      throw new NotFoundException({
        statusCode: 404,
        code: 'RECRUITMENT_NOT_FOUND',
        message: '모집글을 찾을 수 없습니다.',
      });
    return recruitment;
  }
  private duplicate() {
    return new ConflictException({
      statusCode: 409,
      code: 'APPLICATION_ALREADY_EXISTS',
      message: '이미 지원한 모집글입니다.',
    });
  }
  private notFound() {
    return new NotFoundException({
      statusCode: 404,
      code: 'APPLICATION_NOT_FOUND',
      message: '지원 내역을 찾을 수 없습니다.',
    });
  }
  private invalidStatus() {
    return new ConflictException({
      statusCode: 409,
      code: 'APPLICATION_INVALID_STATUS',
      message: '대기 중인 지원만 취소하거나 승인·거절할 수 있습니다.',
    });
  }
}
