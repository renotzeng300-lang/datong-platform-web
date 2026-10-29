'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { asset } from '@/lib/supabase/browser';

function Login() {
  const next = useSearchParams().get('next');
  useEffect(() => { document.title = '登入｜大同發展中心'; }, []);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card relative w-full max-w-sm overflow-hidden p-7">
        <div aria-hidden className="brand-stripe absolute inset-x-0 top-0 h-1.5" />
        <div className="mb-6">
          <span className="block rounded-lg bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset('/brand/logo-horizontal.png')} alt="臺北市大同發展中心" width={720} height={157} className="h-auto w-full" />
          </span>
          <h1 className="h1 mt-4">營運暨評鑑追蹤平台</h1>
        </div>
        <LoginForm next={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} />
        <p className="mt-6 text-xs leading-relaxed text-muted">
          每位同仁使用個人帳號登入，帳號由主任邀請開通，不提供自行註冊或共用帳號。忘記密碼請聯絡主任重新寄送設定連結。
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><Login /></Suspense>;
}
