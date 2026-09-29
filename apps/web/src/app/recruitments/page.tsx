import { Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { RecruitmentList } from '@/features/recruitments/recruitment-list';

export default function RecruitmentsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RecruitmentList />
    </Suspense>
  );
}
