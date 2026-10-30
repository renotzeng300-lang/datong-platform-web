'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { SetPasswordForm } from './SetPasswordForm';

export default function SetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    document.title = '設定密碼｜大同發展中心';
    supabaseBrowser().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login'); else setEmail(data.user.email ?? '');
    });
  }, [router]);
  if (email === null) return <div data-loading className="p-6 text-sm text-muted">載入中…</div>;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7">
        <h1 className="h1 mb-1">設定密碼</h1>
        <p className="mb-1 text-sm text-muted">{email}</p>
        <p className="mb-5 text-xs text-muted">第一次登入、收到臨時密碼，或想更換密碼，都在這裡設定新密碼。請勿與其他網站共用。</p>
        <SetPasswordForm />
        <p className="mt-4 text-center text-sm"><Link href="/" className="text-accent">取消，回首頁</Link></p>
      </div>
    </div>
  );
}
