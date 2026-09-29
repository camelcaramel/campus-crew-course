'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useLoginMutation } from './queries';
import { loginSchema, type LoginValues } from './schema';

export function LoginForm() {
  const router = useRouter();
  const mutation = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  function submit(values: LoginValues) {
    if (mutation.isPending) return;
    mutation.mutate(values, { onSuccess: () => router.push('/recruitments') });
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="mt-8 space-y-6">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="student@example.com"
          {...register('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="h-11 w-full rounded-lg border border-neutral-200 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary-600"
        />
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            className="mt-2 text-sm text-red-600!"
          >
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해주세요"
          {...register('password')}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className="h-11 w-full rounded-lg border border-neutral-200 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary-600"
        />
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="mt-2 text-sm text-red-600!"
          >
            {errors.password.message}
          </p>
        )}
      </div>
      {mutation.error && (
        <p role="alert" className="text-sm text-red-600!">
          {mutation.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="h-11 w-full rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
      >
        {mutation.isPending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
