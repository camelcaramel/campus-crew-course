'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMeQuery } from '@/features/auth/queries';
import { Spinner } from '@/components/ui/spinner';
import { ErrorMessage } from '@/components/ui/error-message';
import { useRouter } from 'next/navigation';
import { createRecruitment } from './api';
import { RecruitmentForm } from './recruitment-form';

export function CreateRecruitmentForm() {
  const router = useRouter();
  const me = useMeQuery();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createRecruitment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recruitments'] });
      router.push('/recruitments');
    },
  });

  if (me.isPending) return <Spinner />;
  if (me.isError)
    return (
      <ErrorMessage
        message="로그인 상태를 확인하지 못했습니다."
        action={
          <button type="button" onClick={() => void me.refetch()}>
            다시 시도
          </button>
        }
      />
    );
  if (!me.data)
    return (
      <p className="mt-6">
        모집글을 작성하려면{' '}
        <Link href="/login" className="text-primary-600 underline">
          로그인
        </Link>
        해주세요.
      </p>
    );

  return (
    <RecruitmentForm
      mode="create"
      onSubmit={(values) => mutation.mutate(values)}
      isPending={mutation.isPending}
      errorMessage={mutation.error?.message}
    />
  );
}
