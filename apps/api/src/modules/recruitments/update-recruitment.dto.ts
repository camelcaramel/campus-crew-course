import { IsIn, IsString, Length, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRecruitmentDto {
  // 생략(undefined)만 허용합니다. 명시적인 null은 DB에 도달하기 전에 거부합니다.
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 80)
  @ApiPropertyOptional({
    example: 'React 스터디 추가 모집',
    minLength: 2,
    maxLength: 80,
  })
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(10, 2000)
  @ApiPropertyOptional({
    example: '매주 토요일에 함께 공부합니다.',
    minLength: 10,
    maxLength: 2000,
  })
  content?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['STUDY', 'PROJECT', 'CONTEST'])
  @ApiPropertyOptional({ enum: ['STUDY', 'PROJECT', 'CONTEST'] })
  category?: 'STUDY' | 'PROJECT' | 'CONTEST';

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['OPEN', 'CLOSED'])
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'], example: 'CLOSED' })
  status?: 'OPEN' | 'CLOSED';
}
