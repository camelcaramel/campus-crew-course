'use client';

import { useCancelApplicationMutation } from './queries';
import type { Application } from './types';

const labels = { PENDING: '검토 대기', APPROVED: '승인됨', REJECTED: '거절됨' };
export function ApplicationStatus({
  application,
  recruitmentId,
  userId,
}: {
  application: Application;
  recruitmentId: string;
  userId: number;
}) {
  const mutation = useCancelApplicationMutation(recruitmentId, userId);
  return (
    <div className="mt-4 space-y-4">
      <p role="status" className="font-medium">
        {labels[application.status]} ({application.status})
      </p>
      <p className="break-words whitespace-pre-wrap">{application.message}</p>
      {application.status === 'PENDING' && (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="min-h-10 rounded-lg border border-neutral-200 px-5 py-2 text-sm disabled:opacity-50"
        >
          {mutation.isPending ? '취소 중...' : '지원 취소'}
        </button>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-600!">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
