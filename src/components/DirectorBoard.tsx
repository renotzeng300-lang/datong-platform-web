'use client';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { BLOCKS, sortItems, type BoardItem } from '@/lib/board';
import { BoardItemRow } from './BoardItemRow';

/** 主任首頁四區塊（伺服器元件，於 Suspense 內串流；資料來自 director_board，與明細頁同一函式） */
export async function DirectorBoard() {
  const sb = getSession()!.sb;
  const { data, error } = await sb.rpc('director_board');
  if (error) {
    return <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">重點區塊暫時無法載入（{error.message}）。下方統計仍可使用，請稍後重新整理。</p>;
  }
  const all = (data ?? []) as BoardItem[];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {BLOCKS.map((b) => {
        const items = sortItems(all.filter((x) => x.block === b.key));
        const border = { danger: 'border-t-danger', hold: 'border-t-hold', warn: 'border-t-warn', accent: 'border-t-accent' }[b.tone];
        return (
          <section key={b.key} className={`card flex flex-col border-t-4 ${border} p-4`} aria-label={b.label}>
            <Link href={`/board/item?block=${encodeURIComponent(b.key)}`} className="group flex items-baseline justify-between gap-2">
              <h3 className="font-semibold group-hover:underline">{b.label}</h3>
              <span className={`text-3xl font-bold tabular-nums ${items.length && b.tone === 'danger' ? 'text-danger' : ''}`}>{items.length}</span>
            </Link>
            {items.length ? (
              <ul className="mt-2 divide-y divide-line">{items.slice(0, 3).map((it) => <BoardItemRow key={it.item_key} it={it} compact />)}</ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{b.empty}</p>
            )}
            {items.length > 3 && <Link href={`/board/item?block=${encodeURIComponent(b.key)}`} className="mt-auto pt-2 text-sm text-accent">查看全部 {items.length} 筆 →</Link>}
          </section>
        );
      })}
    </div>
  );
}

export function DirectorBoardSkeleton() {
  return (
    <div role="status" aria-live="polite" data-loading className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {BLOCKS.map((b) => (
        <div key={b.key} className="card h-36 animate-pulse p-4">
          <div className="font-semibold text-muted">{b.label}</div>
          <div className="mt-3 h-3 w-3/4 rounded bg-line" /><div className="mt-2 h-3 w-1/2 rounded bg-line" />
        </div>
      ))}
      <span className="sr-only">重點區塊載入中…</span>
    </div>
  );
}
