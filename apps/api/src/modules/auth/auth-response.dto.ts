import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '김학생' })
  name!: string;

  @ApiProperty({ example: 'student@example.com' })
  email!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: '로그아웃되었습니다.' })
  message!: string;
}
