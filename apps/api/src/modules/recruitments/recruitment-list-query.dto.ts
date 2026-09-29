import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { RecruitmentCategory } from '../../../generated/prisma/client';

// Number('')/parseInt('1abc') 같은 느슨한 변환을 피합니다.
function queryInteger({ value }: { value: unknown }): unknown {
  return typeof value === 'string' && /^[0-9]+$/.test(value)
    ? Number(value)
    : value;
}

export class RecruitmentListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 2147483647 })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @ApiPropertyOptional({ description: '제목 검색 (대소문자 구분 없음)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['STUDY', 'PROJECT', 'CONTEST'] })
  @IsOptional()
  @IsIn(['STUDY', 'PROJECT', 'CONTEST'])
  category?: RecruitmentCategory;
}
