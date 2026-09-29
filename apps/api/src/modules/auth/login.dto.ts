import { PickType } from '@nestjs/swagger';
import { SignupDto } from './signup.dto';

// 회원가입과 동일한 email/password 규칙(UTF-8 72바이트 포함)을 재사용합니다.
export class LoginDto extends PickType(SignupDto, [
  'email',
  'password',
] as const) {}
