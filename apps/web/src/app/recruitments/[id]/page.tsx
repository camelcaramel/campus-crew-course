'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMeQuery } from '@/features/auth/queries';
import { ApplicationSection } from '@/features/applications/application-section';
import { ApplicationManager } from '@/features/applications/application-manager';
import { useState } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Spinner } from '@/components/ui/spinner';
import { deleteRecruitment } from '@/features/recruitments/api';
import { useRecruitmentQuery } from '@/features/recruitments/queries';
import { recruitmentCategoryLabels } from '@/features/recruitments/types';

export default function RecruitmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMeQuery();
  const queryClient = useQueryClient();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: () => deleteRecruitment(Number(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['recruitments'],
        exact: true,
      });
      // 삭제 직후 활성 상세를 재조회하지 않습니다. 다시 방문하면 404를 확인합니다.
      await queryClient.invalidateQueries({
        queryKey: ['recruitments', id],
        exact: true,
        refetchType: 'none',
      });
      router.replace('/recruitments');
    },
  });

  function handleDelete() {
    if (!isOwner || mutation.isPending || !isConfirmingDelete) return;
    mutation.mutate();
  }
  const {
    data: recruitment,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useRecruitmentQuery(id);

  if (isPending || isError) {
    return (
      <section className="pt-4">
        <Link
          href="/recruitments"
          className="text-sm text-primary-600 hover:underline"
        >
          모집글 목록으로
        </Link>
        <div className="mt-6">
          {isPending ? (
            <Spinner />
          ) : (
            <ErrorMessage
              message={
                error.message === '모집글을 찾을 수 없습니다.'
                  ? error.message
                  : '모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
              }
              action={
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="min-h-10 rounded-lg border border-neutral-200 px-4 py-2 text-sm text-primary-600 disabled:opacity-50"
                >
                  다시 시도
                </button>
              }
            />
          )}
        </div>
      </section>
    );
  }

  const isOpen = recruitment.status === 'OPEN';
  const isOwner =
    !me.isPending && !me.isError && me.data?.user.id === recruitment.author.id;

  return (
    // 기존 layout의 위쪽 여백 32px + 이 페이지의 16px = 48px
    <section className="pt-4">
      <Link
        href="/recruitments"
        className="text-sm text-primary-600 hover:underline"
      >
        모집글 목록으로
      </Link>

      <article className="mt-6 max-w-3xl rounded-xl border border-neutral-200 p-6 sm:p-8">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-neutral-500">
            {recruitmentCategoryLabels[recruitment.category]}
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              isOpen
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isOpen ? '모집 중' : '모집 마감'}
          </span>
        </div>

        <h1 className="mt-4 text-3xl! leading-snug font-bold break-words text-neutral-900 sm:text-4xl!">
          {recruitment.title}
        </h1>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
          <span>{recruitment.author.name}</span>
          <time dateTime={recruitment.createdAt}>
            {recruitment.createdAt.slice(0, 10)}
          </time>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-8">
          <p className="leading-8 break-words whitespace-pre-wrap text-neutral-900!">
            {recruitment.content}
          </p>
        </div>
        {/* 버튼 숨김은 UX입니다. 직접 API 호출은 서버 Guard와 owner check가 보호합니다. */}
        {isOwner && (
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => router.push(`/recruitments/${id}/edit`)}
              className="min-h-10 rounded-lg border border-neutral-200 px-5 text-sm disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => setIsConfirmingDelete(true)}
              className="min-h-10 rounded-lg border border-red-200 px-5 text-sm text-red-600 disabled:opacity-50"
            >
              {mutation.isPending ? '삭제 중...' : '삭제'}
            </button>
          </div>
        )}
        {isOwner && isConfirmingDelete && (
          <div
            role="group"
            aria-label="삭제 확인"
            className="mt-4 rounded-lg border border-red-200 p-4"
          >
            <p>정말 삭제할까요?</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => setIsConfirmingDelete(false)}
                className="min-h-10 rounded-lg border border-neutral-200 px-4 text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={handleDelete}
                className="min-h-10 rounded-lg bg-red-600 px-4 text-sm text-white disabled:opacity-50"
              >
                {mutation.isPending ? '삭제 중...' : '삭제 확인'}
              </button>
            </div>
          </div>
        )}
        {mutation.isError && (
          <p role="alert" className="mt-4 text-sm text-red-600!">
            {mutation.error.message}
          </p>
        )}
        {isOwner && me.data && (
          <ApplicationManager
            key={`${id}:${me.data.user.id}`}
            recruitmentId={id}
            userId={me.data.user.id}
          />
        )}
        <ApplicationSection
          recruitmentId={id}
          authorId={recruitment.author.id}
          status={recruitment.status}
        />
      </article>
    </section>
  );
}
