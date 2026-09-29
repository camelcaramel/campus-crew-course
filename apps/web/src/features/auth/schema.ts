import { z } from 'zod';

export const loginSchema = z.object({
  // signup의 IsEmail은 Unicode/quoted local part도 허용합니다.
  // 프론트는 가벼운 형식 검사만 하고 정확한 검증은 같은 API DTO에 맡깁니다.
  email: z
    .string()
    .regex(/^.+@[^@\s]+\.[^@\s]+$/u, '올바른 이메일을 입력해주세요.'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상 입력해주세요.')
    .max(50, '비밀번호는 50자 이하로 입력해주세요.')
    .refine(
      (value) =>
        !/[\uD800-\uDFFF]/u.test(value) &&
        new TextEncoder().encode(value).length <= 72,
      '비밀번호는 올바른 유니코드이며 UTF-8 72바이트 이하여야 합니다.',
    ),
});
export type LoginValues = z.infer<typeof loginSchema>;
