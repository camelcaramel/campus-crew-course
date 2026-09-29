'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import type { RecruitmentListParams } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorMessage } from '@/components/ui/error-message';
import { Spinner } from '@/components/ui/spinner';
import { getRecruitments } from '@/features/recruitments/api';
import { RecruitmentCard } from '@/features/recruitments/recruitment-card';

export function RecruitmentList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = searchParams.get('q') ?? '';
  const categoryValue = searchParams.get('category');
  const category =
    categoryValue === 'STUDY' ||
    categoryValue === 'PROJECT' ||
    categoryValue === 'CONTEST'
      ? categoryValue
      : undefined;
  const limit = positiveInteger(searchParams.get('limit'), 10, 50);
  const page = positiveInteger(
    searchParams.get('page'),
    1,
    Math.min(2147483647, Math.floor(2147483647 / limit) + 1),
  );
  const params: RecruitmentListParams = { q, category, page, limit };

  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    navigate({ q: typeof value === 'string' ? value.trim() : '', page: '1' });
  }

  const {
    data: recruitments,
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['recruitments', params],
    queryFn: () => getRecruitments(params),
  });

  let content;

  if (isPending) {
    content = <Spinner />;
  } else if (isError) {
    content = (
      <ErrorMessage
        message="모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
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
    );
  } else if (recruitments.items.length === 0) {
    content = (
      <EmptyState
        message={
          q || category
            ? '검색 조건에 맞는 모집글이 없습니다. 검색어나 카테고리를 바꿔보세요.'
            : '이 페이지에 모집글이 없습니다.'
        }
        action={
          <Link
            href="/recruitments/new"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          >
            모집글 작성
          </Link>
        }
      />
    );
  } else {
    content = (
      <ul className="space-y-4">
        {recruitments.items.map((recruitment) => (
          // key는 React가 각 항목을 구분하도록 반복 결과의 최상위 요소에 둡니다.
          <li key={recruitment.id}>
            <RecruitmentCard recruitment={recruitment} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section>
      <h1>함께할 팀원을 찾아보세요</h1>
      <p>스터디와 프로젝트를 함께할 사람을 찾아보세요.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <form onSubmit={search} className="flex flex-1 items-end gap-2">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="recruitment-search"
              className="mb-1 block text-sm font-medium"
            >
              제목 검색
            </label>
            <input
              key={searchParams.toString()}
              id="recruitment-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="검색어를 입력하세요"
              className="min-h-10 w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          >
            검색
          </button>
        </form>
        <div>
          <label
            htmlFor="recruitment-category"
            className="mb-1 block text-sm font-medium"
          >
            카테고리
          </label>
          <select
            id="recruitment-category"
            value={category ?? ''}
            onChange={(event) =>
              navigate({ category: event.target.value, page: '1' })
            }
            className="min-h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2"
          >
            <option value="">전체</option>
            <option value="STUDY">스터디</option>
            <option value="PROJECT">프로젝트</option>
            <option value="CONTEST">공모전</option>
          </select>
        </div>
      </div>
      <div className="mt-8 min-h-80">{content}</div>
      {!isPending && !isError && (
        <nav
          aria-label="모집글 페이지"
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => navigate({ page: String(page - 1) })}
            className="min-h-10 rounded-lg border border-neutral-200 px-4 py-2 disabled:opacity-40"
          >
            이전
          </button>
          <p aria-live="polite" className="text-sm text-neutral-600">
            총 {recruitments.meta.total}개 · {page} /{' '}
            {recruitments.meta.totalPages}페이지
          </p>
          <button
            type="button"
            disabled={page >= recruitments.meta.totalPages}
            onClick={() => navigate({ page: String(page + 1) })}
            className="min-h-10 rounded-lg border border-neutral-200 px-4 py-2 disabled:opacity-40"
          >
            다음
          </button>
          {page > 1 && page > recruitments.meta.totalPages && (
            <button
              type="button"
              onClick={() => navigate({ page: '1' })}
              className="min-h-10 rounded-lg border border-neutral-200 px-4 py-2"
            >
              첫 페이지로
            </button>
          )}
        </nav>
      )}
    </section>
  );
}

function positiveInteger(
  value: string | null,
  fallback: number,
  max: number,
): number {
  if (!value || !/^[0-9]+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= max
    ? number
    : fallback;
}
