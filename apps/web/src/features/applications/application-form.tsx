'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useCreateApplicationMutation } from './queries';
import { applicationSchema, type ApplicationFormValues } from './schema';

export function ApplicationForm({
  recruitmentId,
  userId,
}: {
  recruitmentId: string;
  userId: number;
}) {
  const mutation = useCreateApplicationMutation(recruitmentId, userId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { message: '' },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="mt-4 space-y-3"
    >
      <label
        htmlFor="application-message"
        className="block text-sm font-medium"
      >
        지원 메시지
      </label>
      <textarea
        id="application-message"
        {...register('message')}
        rows={4}
        disabled={mutation.isPending}
        aria-invalid={Boolean(errors.message)}
        aria-describedby={
          errors.message
            ? 'application-message-error'
            : 'application-message-hint'
        }
        className="w-full rounded-lg border border-neutral-200 p-3 disabled:opacity-50"
        placeholder="함께하고 싶은 이유를 알려주세요."
      />
      <p id="application-message-hint" className="text-sm text-neutral-500">
        2~200자로 입력해주세요.
      </p>
      {errors.message && (
        <p
          id="application-message-error"
          role="alert"
          className="text-sm text-red-600!"
        >
          {errors.message.message}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-600!">
          {mutation.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="min-h-10 rounded-lg bg-primary-600 px-5 py-2 text-sm text-white disabled:opacity-50"
      >
        {mutation.isPending ? '지원 중...' : '지원하기'}
      </button>
    </form>
  );
}
