'use client';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SignOutButton } from '@/components/SignOutButton';

const REASON: Record<string, string> = {
  unlinked: '這個登入帳號尚未對應到中心的人員資料。請聯絡主任確認。',
  director: '此頁面只有主任可以使用。',
};

function NoAccess() {
  const reason = useSearchParams().get('reason');
  useEffect(() => { document.title = '無法使用｜大同發展中心'; }, []);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-7">
        <h1 className="h1 mb-3">目前無法使用此功能</h1>
        <p className="text-muted">
          {REASON[reason ?? ''] ?? '你的帳號目前暫停、在職狀態尚未確認，或正在留職停薪期間。留停期間系統不會派工或寄送通知；復職後由主任核定重新開通。'}
        </p>
        <div className="mt-6 flex gap-2">
          <Link href="/" className="btn-ghost">回首頁</Link>
          <SignOutButton className="btn-ghost" />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><NoAccess /></Suspense>;
}
