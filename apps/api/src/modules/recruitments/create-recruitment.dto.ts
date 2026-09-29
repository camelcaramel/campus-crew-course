import { IsIn, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO는 TypeScript 타입과 달리 런타임 HTTP 입력도 검사합니다.
export class CreateRecruitmentDto {
  @IsString()
  @Length(2, 80)
  @ApiProperty({
    example: 'React 스터디 팀원 모집',
    minLength: 2,
    maxLength: 80,
  })
  title!: string;

  @IsString()
  @Length(10, 2000)
  @ApiProperty({
    example: '주 1회 함께 공부할 팀원을 모집합니다.',
    minLength: 10,
    maxLength: 2000,
  })
  content!: string;

  @IsIn(['STUDY', 'PROJECT', 'CONTEST'])
  @ApiProperty({ enum: ['STUDY', 'PROJECT', 'CONTEST'], example: 'STUDY' })
  category!: 'STUDY' | 'PROJECT' | 'CONTEST';
}
