import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({
    example: '함께 참여하고 싶습니다.',
    minLength: 2,
    maxLength: 200,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 200, { message: '지원 메시지는 2~200자로 입력해주세요.' })
  message!: string;
}
