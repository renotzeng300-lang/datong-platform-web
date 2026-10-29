'use client';
// 純網頁版外框：確認登入 → 讀取目前使用者（me）→ 顯示選單與徽章數字。
// 未登入→登入頁；帳號未連結→無法使用（unlinked）；停用／留停／未確認在職→無法使用。
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { setNavigator, setSession } from '@/lib/session';
import type { Me } from '@/lib/types';

function Frame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [counts, setCounts] = useState({ unread: 0, pending: 0 });

  useEffect(() => { setNavigator((to) => router.push(to)); return () => setNavigator(null); }, [router]);

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!alive) return;
      if (!s.session) {
        const next = path + (sp.toString() ? `?${sp.toString()}` : '');
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const { data } = await sb.rpc('me');
      if (!alive) return;
      const m = data as Me | null;
      if (!m) { router.replace('/no-access?reason=unlinked'); return; }
      if (!m.active) { router.replace('/no-access'); return; }
      setSession({ me: m, sb });
      setMe(m);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { setSession(null); router.replace('/login'); } });
    return () => { alive = false; sub.subscription.unsubscribe(); };
    // 只在進入外框時確認一次登入；換頁不重查
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCounts = useCallback(async () => {
    if (!me) return;
    const sb = supabaseBrowser();
    const canDecide = me.is_director || me.roles.some((r) => r.role === 'dept_lead');
    const [{ count: unread }, queue] = await Promise.all([
      sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      canDecide ? sb.rpc('decision_queue') : Promise.resolve({ data: [] as unknown[] }),
    ]);
    // 徽章數字＝決策佇列中「你有權處理」的筆數（與佇列頁一致）
    setCounts({ unread: unread ?? 0, pending: (queue.data as unknown[] | null)?.length ?? 0 });
  }, [me]);
  useEffect(() => { void loadCounts(); }, [loadCounts, path]);
  useEffect(() => {
    const h = () => { void loadCounts(); };
    window.addEventListener('datong:refresh', h);
    return () => window.removeEventListener('datong:refresh', h);
  }, [loadCounts]);

  if (!me) return <div data-loading className="flex min-h-screen items-center justify-center text-sm text-muted" role="status">載入中…</div>;
  return <AppShell me={me} unread={counts.unread} pending={counts.pending}>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div data-loading className="p-6 text-sm text-muted">載入中…</div>}><Frame>{children}</Frame></Suspense>;
}
