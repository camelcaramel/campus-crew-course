import { LoginForm } from '@/features/auth/login-form';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md py-8" aria-labelledby="login-title">
      <h1 id="login-title">로그인</h1>
      <p>Campus Crew에서 함께할 팀원을 만나보세요.</p>
      <LoginForm />
      <p className="mt-6 text-sm text-neutral-500">
        아직 계정이 없나요?{' '}
        <Link href="/signup" className="text-primary-600 underline">
          회원가입
        </Link>
      </p>
    </section>
  );
}
