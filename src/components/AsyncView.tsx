'use client';
// 純網頁版的頁面外框：在瀏覽器執行頁面的「讀資料＋組畫面」函式，把結果放到畫面上。
//  • 網址參數（?id=、?status=…）同時當作 params 與 searchParams 傳入
//  • 操作完成呼叫 refresh() 時重新讀取，不清空目前畫面（避免閃爍、保留捲動位置）
//  • 讀取中顯示 data-loading（端到端測試以此判斷載入完成）
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { beginReload, endReload, NotFoundSignal, RedirectSignal } from '@/lib/session';

export type PageCtx = { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | undefined>> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = (ctx: any) => Promise<ReactNode>;

export function AsyncView({ load, title, fallback }: { load: Loader; title?: string; fallback?: ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [node, setNode] = useState<ReactNode>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const seq = useRef(0);
  const key = sp.toString();

  const run = useCallback(async () => {
    const my = ++seq.current;
    const q = Object.fromEntries(new URLSearchParams(key).entries());
    beginReload();
    try {
      const out = await load({ params: Promise.resolve(q), searchParams: Promise.resolve(q) });
      if (my !== seq.current) return;
      setNode(out); setState('ok');
    } catch (e) {
      if (my !== seq.current) return;
      if (e instanceof RedirectSignal) { router.replace(e.to); return; }
      if (e instanceof NotFoundSignal) { setState('notfound'); return; }
      console.error(e);
      setState('error');
    } finally {
      endReload();
    }
  }, [key, load, router]);

  useEffect(() => { setState((s) => (s === 'ok' ? s : 'loading')); void run(); }, [run]);
  useEffect(() => {
    const h = () => { void run(); };
    window.addEventListener('datong:refresh', h);
    return () => window.removeEventListener('datong:refresh', h);
  }, [run]);
  useEffect(() => { if (title) document.title = `${title}｜大同發展中心`; }, [title]);

  if (state === 'notfound') return (
    <div className="card max-w-xl space-y-3 p-6">
      <h1 className="h2">找不到資料</h1>
      <p className="text-sm text-muted">這筆資料不存在，或你沒有檢視權限。</p>
      <Link href="/" className="btn-ghost inline-block">回首頁</Link>
    </div>
  );
  if (state === 'error') return (
    <div role="alert" className="card max-w-xl space-y-3 p-6">
      <h1 className="h2 text-danger">資料暫時無法載入</h1>
      <p className="text-sm text-muted">可能是網路或資料庫連線短暫中斷。請按「重試」；若持續發生，請通知系統管理者。</p>
      <button type="button" onClick={() => { setState('loading'); void run(); }} className="btn-primary">重試</button>
    </div>
  );
  if (state === 'loading' && node === null) return fallback ? <div data-loading>{fallback}</div> : <div data-loading className="p-6 text-sm text-muted" role="status">載入中…</div>;
  return <>{node}</>;
}

/** 把「自己讀資料的元件」（原本的非同步伺服器元件）放進畫面 */
export function Async({ of: Comp, fallback }: { of: () => Promise<ReactNode>; fallback?: ReactNode }) {
  const load = useCallback(() => Comp(), [Comp]);
  return <AsyncView load={load} fallback={fallback} />;
}

/** 頁面函式（原本的伺服器頁面）型別寬鬆：參數由網址 ?key= 提供 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PageLoader = (ctx: any) => Promise<ReactNode>;
