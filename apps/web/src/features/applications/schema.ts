import { z } from 'zod';

export const applicationSchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, '지원 메시지는 2자 이상 입력해주세요.')
    .max(200, '지원 메시지는 200자 이하로 입력해주세요.'),
});
export type ApplicationFormValues = z.infer<typeof applicationSchema>;
