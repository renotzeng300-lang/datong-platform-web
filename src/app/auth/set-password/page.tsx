'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
        <p className="mb-5 text-sm text-muted">{email}</p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
