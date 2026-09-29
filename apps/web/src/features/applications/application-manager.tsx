'use client';

import { EmptyState } from '@/components/ui/empty-state';
import {
  useApplicationsQuery,
  useUpdateApplicationStatusMutation,
} from './queries';

const labels = { PENDING: '검토 대기', APPROVED: '승인됨', REJECTED: '거절됨' };
const colors = {
  PENDING: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-gray-100 text-gray-600',
};

export function ApplicationManager({
  recruitmentId,
  userId,
}: {
  recruitmentId: string;
  userId: number;
}) {
  const query = useApplicationsQuery(recruitmentId, userId);
  const mutation = useUpdateApplicationStatusMutation(recruitmentId, userId);

  return (
    <section
      aria-label="지원자 관리"
      className="mt-8 border-t border-neutral-200 pt-6"
    >
      <h2 className="text-xl font-semibold">지원자 관리</h2>
      {query.isPending ? (
        <p role="status" className="mt-4">
          지원자를 불러오고 있습니다.
        </p>
      ) : query.isError ? (
        <div role="alert" className="mt-4">
          <p>지원자를 불러오지 못했습니다. {query.error.message}</p>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="min-h-10 text-primary-600 disabled:opacity-50"
          >
            다시 시도
          </button>
        </div>
      ) : query.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="아직 지원자가 없습니다." />
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {query.data.map((application) => (
            <li
              key={application.id}
              className="rounded-lg border border-neutral-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold break-words">
                    {application.applicant.name}
                  </h3>
                  <p className="text-sm break-all text-neutral-500">
                    {application.applicant.email}
                  </p>
                </div>
                <span
                  role="status"
                  className={`rounded-full px-3 py-1 text-xs ${colors[application.status]}`}
                >
                  {labels[application.status]} ({application.status})
                </span>
              </div>
              <p className="mt-3 break-words whitespace-pre-wrap">
                {application.message}
              </p>
              <time
                dateTime={application.createdAt}
                className="mt-2 block text-xs text-neutral-500"
              >
                {application.createdAt.slice(0, 10)}
              </time>
              {application.status === 'PENDING' && (
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        applicationId: application.id,
                        status: 'APPROVED',
                      })
                    }
                    className="min-h-10 rounded-lg bg-primary-600 px-5 text-sm text-white disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        applicationId: application.id,
                        status: 'REJECTED',
                      })
                    }
                    className="min-h-10 rounded-lg border border-neutral-200 px-5 text-sm disabled:opacity-50"
                  >
                    거절
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {mutation.isPending && (
        <p role="status" className="mt-4 text-sm">
          처리 중입니다.
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="mt-4 text-sm text-red-600!">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
