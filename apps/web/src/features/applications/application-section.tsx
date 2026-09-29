'use client';

import Link from 'next/link';
import { useMeQuery } from '@/features/auth/queries';
import { ApplicationForm } from './application-form';
import { ApplicationStatus } from './application-status';
import { useMyApplicationQuery } from './queries';

type Props = {
  recruitmentId: string;
  authorId: number;
  status: 'OPEN' | 'CLOSED';
};

function ApplicantView({
  recruitmentId,
  userId,
  status,
}: Omit<Props, 'authorId'> & { userId: number }) {
  const query = useMyApplicationQuery(recruitmentId, userId);
  if (query.isPending)
    return <p role="status">지원 내역을 확인하고 있습니다.</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>지원 내역을 확인하지 못했습니다. {query.error.message}</p>
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="mt-3 min-h-10 text-primary-600"
        >
          다시 시도
        </button>
      </div>
    );
  if (query.data.application)
    return (
      <ApplicationStatus
        application={query.data.application}
        recruitmentId={recruitmentId}
        userId={userId}
      />
    );
  if (status === 'CLOSED')
    return <p>마감된 모집글입니다. 새로운 지원을 받지 않습니다.</p>;
  return <ApplicationForm recruitmentId={recruitmentId} userId={userId} />;
}

export function ApplicationSection({ recruitmentId, authorId, status }: Props) {
  const me = useMeQuery();
  if (me.isPending)
    return (
      <p role="status" className="mt-8">
        로그인 상태를 확인하고 있습니다.
      </p>
    );
  if (me.isError)
    return (
      <div role="alert" className="mt-8">
        <p>로그인 상태를 확인하지 못했습니다.</p>
        <button
          type="button"
          disabled={me.isFetching}
          onClick={() => void me.refetch()}
          className="min-h-10 text-primary-600"
        >
          다시 시도
        </button>
      </div>
    );
  if (!me.data)
    return (
      <p className="mt-8">
        <Link href="/login" className="text-primary-600 hover:underline">
          로그인
        </Link>{' '}
        후 모집글에 지원할 수 있습니다.
      </p>
    );
  if (me.data.user.id === authorId) return null;
  return (
    <section
      aria-label="내 지원"
      className="mt-8 border-t border-neutral-200 pt-6"
    >
      <h2 className="text-xl font-semibold">내 지원</h2>
      <ApplicantView
        key={`${recruitmentId}:${me.data.user.id}`}
        recruitmentId={recruitmentId}
        userId={me.data.user.id}
        status={status}
      />
    </section>
  );
}
