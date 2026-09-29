import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' })
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'status는 APPROVED 또는 REJECTED만 허용합니다.',
  })
  status!: 'APPROVED' | 'REJECTED';
}
