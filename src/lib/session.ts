'use client';
// 登入者與導覽（純網頁版）：頁面讀資料的函式仍可寫 `const { me, sb } = await requireMe()`，
// 由外框（AppFrame）在登入確認後設定目前使用者。權限一律以資料庫為準，這裡只決定畫面導向。
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Me } from './types';

let current: { me: Me; sb: SupabaseClient } | null = null;
export function setSession(s: { me: Me; sb: SupabaseClient } | null) { current = s; }
export function getSession() { return current; }

/** 讀資料途中要換頁：丟出訊號，由 AsyncView 執行導向 */
export class RedirectSignal { constructor(public to: string) {} }
export class NotFoundSignal {}
export function redirect(to: string): never { throw new RedirectSignal(to); }
export function notFound(): never { throw new NotFoundSignal(); }

export async function requireMe(opts: { allowInactive?: boolean } = {}) {
  if (!current) redirect('/login');
  if (!current.me.active && !opts.allowInactive) redirect('/no-access');
  return current;
}

export async function requireDirector() {
  const r = await requireMe();
  if (!r.me.is_director) redirect('/no-access?reason=director');
  return r;
}

export const hasRole = (me: Me, role: string, dept?: string) =>
  me.roles.some((r) => r.role === role && (!dept || !r.department_id || r.department_id === dept));

/** 操作完成後：重新讀取目前畫面的資料（取代伺服器版的 revalidatePath） */
let refreshQueued = false;
export function refresh() {
  if (typeof window === 'undefined' || refreshQueued) return;
  refreshQueued = true;   // 同一次操作內呼叫多次，只重新讀取一次
  setTimeout(() => { refreshQueued = false; window.dispatchEvent(new Event('datong:refresh')); }, 0);
}

/** 重新讀取並等到畫面資料都讀完（「保留輸入並載入最新資料」用：讀完前不能送出） */
let inflight = 0;
const waiters: (() => void)[] = [];
export function beginReload() { inflight++; }
export function endReload() { inflight = Math.max(0, inflight - 1); if (inflight === 0) waiters.splice(0).forEach((f) => f()); }
export function refreshAndWait(): Promise<void> {
  return new Promise((resolve) => {
    refresh();
    setTimeout(() => { if (inflight === 0) resolve(); else waiters.push(resolve); }, 20);
  });
}

/** 操作完成後換頁（取代伺服器版 server action 的 redirect） */
type Nav = (to: string) => void;
let navigator_: Nav | null = null;
export function setNavigator(n: Nav | null) { navigator_ = n; }
export function go(to: string) {
  if (navigator_) navigator_(to);
  else if (typeof window !== 'undefined') window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${to}`);
}

/** 詳細頁網址：GitHub Pages 只能放固定頁面，以 ?id= 帶編號 */
export const itemHref = (base: string, id: string, extra = '') => `${base}/item?id=${encodeURIComponent(id)}${extra}`;
