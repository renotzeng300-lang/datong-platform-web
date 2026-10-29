'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const f = new FormData(e.currentTarget);
        const { error } = await supabaseBrowser().auth.signInWithPassword({
          email: String(f.get('email')),
          password: String(f.get('password')),
        });
        setBusy(false);
        if (error) {
          setError(error.message === 'Invalid login credentials' ? '帳號或密碼不正確' : `登入失敗：${error.message}`);
          return;
        }
        router.replace(next);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="email" className="label">電子郵件</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">密碼</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? '登入中…' : '登入'}</button>
    </form>
  );
}
