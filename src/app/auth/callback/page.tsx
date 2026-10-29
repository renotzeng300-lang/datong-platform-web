'use client';
// 主任在 Supabase 後台寄出的邀請信／重設密碼信，連結會回到這裡（網址 # 後帶登入憑證）。
// 網頁讀取憑證完成登入後，導向設定密碼頁。
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('正在確認邀請連結…');
  useEffect(() => {
    const sb = supabaseBrowser();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (/error_description=/.test(hash)) {
      const d = new URLSearchParams(hash.slice(1)).get('error_description') ?? '';
      setMsg(`連結無效或已過期（${d}）。請聯絡主任重新寄送邀請。`);
      return;
    }
    let done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; router.replace(ok ? '/auth/set-password' : '/login'); };
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { if (s) finish(true); });
    sb.auth.getSession().then(({ data }) => { if (data.session) finish(true); });
    const t = setTimeout(() => { if (!done) setMsg('連結無效或已過期。請聯絡主任重新寄送邀請。'); }, 8000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="card max-w-sm p-6 text-sm" role="status">{msg}</p>
    </div>
  );
}
