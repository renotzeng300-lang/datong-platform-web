'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function SetPasswordForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const a = String(f.get('p1'));
        if (a.length < 10) return setMsg('密碼至少 10 個字元');
        if (a !== String(f.get('p2'))) return setMsg('兩次輸入不一致');
        const { error } = await supabaseBrowser().auth.updateUser({ password: a });
        if (error) return setMsg(error.message);
        router.replace('/');
      }}
    >
      <div><label className="label" htmlFor="p1">新密碼（至少 10 字元）</label><input id="p1" name="p1" type="password" autoComplete="new-password" className="field" required /></div>
      <div><label className="label" htmlFor="p2">再輸入一次</label><input id="p2" name="p2" type="password" autoComplete="new-password" className="field" required /></div>
      {msg && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{msg}</p>}
      <button className="btn-primary w-full">儲存並進入系統</button>
    </form>
  );
}
