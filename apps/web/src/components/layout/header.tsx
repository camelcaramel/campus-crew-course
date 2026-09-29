'use client';

import Link from 'next/link';
import { useLogoutMutation, useMeQuery } from '@/features/auth/queries';
import { Container } from './container';

export function Header() {
  const me = useMeQuery();
  const logout = useLogoutMutation();

  return (
    <header className="h-16 border-b border-neutral-200 bg-white">
      <Container className="flex h-full items-center justify-between gap-6">
        <Link href="/" className="shrink-0 text-xl font-bold text-primary-600">
          Campus Crew
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-6 text-sm">
          <Link href="/recruitments" className="text-neutral-900">
            모집글
          </Link>
          {me.isPending ? (
            <span className="text-neutral-500" role="status">
              로그인 확인 중…
            </span>
          ) : me.isError ? (
            <button
              type="button"
              onClick={() => void me.refetch()}
              className="text-neutral-500"
            >
              로그인 상태 다시 확인
            </button>
          ) : me.data ? (
            <>
              <span>{me.data.user.name}님</span>
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                className="text-neutral-500 disabled:opacity-60"
              >
                {logout.isPending ? '로그아웃 중…' : '로그아웃'}
              </button>
            </>
          ) : (
            <Link href="/login" className="text-neutral-900">
              로그인
            </Link>
          )}
          {logout.error && (
            <span role="alert" className="text-sm text-red-600">
              {logout.error.message}
            </span>
          )}
          <Link href="/signup" className="text-neutral-500">
            회원가입
          </Link>
        </nav>
      </Container>
    </header>
  );
}
