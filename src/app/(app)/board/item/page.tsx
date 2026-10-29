'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireMe } from '@/lib/session';
import { BLOCKS, sortItems, type BoardItem } from '@/lib/board';
import { BoardItemRow } from '@/components/BoardItemRow';
import { fmtDate, todayTaipei } from '@/lib/format';

/** 明細頁：與首頁數字用同一個資料庫函式 director_board，筆數必然一致 */
async function BoardDetail({ params }: { params: Promise<{ block: string }> }) {
  const { block } = await params;
  const meta = BLOCKS.find((b) => b.key === block);
  if (!meta) notFound();
  const { sb } = await requireMe();
  const { data, error } = await sb.rpc('director_board', { p_block: meta.key });
  const items = sortItems((data ?? []) as BoardItem[]);
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/" className="text-sm text-accent">← 儀表板</Link>
        <h1 className="h1 mt-1">{meta.label}{!error && <span className="ml-2 tabular-nums text-muted">{items.length}</span>}</h1>
        <p className="mt-1 text-sm text-muted">判斷條件：{meta.rule}（日期以臺北時區 {fmtDate(todayTaipei())} 計算）</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">無法載入：{error.message}。請重新整理，若持續發生請通知系統管理者。</p>}
      {!error && !items.length && <p className="card p-6 text-center text-muted">{meta.empty}</p>}
      {!error && items.length > 0 && <ul className="space-y-2">{items.map((it) => <BoardItemRow key={it.item_key} it={it} />)}</ul>}
      {meta.key === 'decision' && items.length > 0 && <Link href="/approvals" className="btn-primary inline-block">前往決策佇列處理</Link>}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={BoardDetail as PageLoader} title="儀表板明細" />;
}
