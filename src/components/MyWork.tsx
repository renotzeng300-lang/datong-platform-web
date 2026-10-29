'use client';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { Badge } from './Badge';
import { fmtDate } from '@/lib/format';

/** 「我的工作」：資料來自資料庫 my_work()（只含本人參與、本人有權查看的工作）；每項工作只出現在一區，計數＝明細 */
export const MY_SECTIONS = [
  { key: 'rework', label: '需要補件或回覆', empty: '沒有被退回、需要補件的工作。', tone: 'border-t-danger' },
  { key: 'due', label: '今天到期／已逾期', empty: '沒有今天到期或逾期的工作。', tone: 'border-t-danger' },
  { key: 'act', label: '需要我處理', empty: '目前沒有需要你先動手的工作。', tone: 'border-t-accent' },
  { key: 'soon', label: '即將到期（7 日內）', empty: '7 日內沒有到期的工作。', tone: 'border-t-warn' },
  { key: 'waiting', label: '我已送出、等待核定', empty: '沒有等待核定的申請。', tone: 'border-t-hold' },
] as const;

export type MyItem = {
  section: string; section_order: number; task_id: string; title: string; my_role: string; status: string;
  approval_status: string; due_on: string | null; days_to_due: number | null; department_name: string;
  owner_name: string | null; next_step: string; detail: string | null; pending_kinds: string[] | null;
};

const ROLE_TONE: Record<string, string> = { 主責: '已核定', 協作: '待處理', 統籌: '待主任核定', 提報人: '待主任核定' };

function Item({ it }: { it: MyItem }) {
  const overdue = it.days_to_due !== null && it.days_to_due < 0 && ['已核定', '免核定'].includes(it.approval_status);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={ROLE_TONE[it.my_role]}>{`我是${it.my_role}`}</Badge>
            <Link href={`/tasks/item?id=${encodeURIComponent(it.task_id)}`} className="font-medium hover:underline">{it.title}</Link>
          </div>
          <p className="mt-1 text-sm"><span aria-hidden>→ </span>{it.next_step}</p>
          {it.detail && <p className="mt-0.5 text-sm text-danger">{it.detail}</p>}
          <p className="mt-0.5 text-xs text-muted">
            狀態：{it.status}{it.approval_status !== '已核定' && it.approval_status !== '免核定' ? `（${it.approval_status}）` : ''}
            {it.my_role !== '主責' && it.owner_name && <>・主責 {it.owner_name}</>}・{it.department_name}
          </p>
        </div>
        <div className={`shrink-0 text-right text-sm ${overdue ? 'font-semibold text-danger' : 'text-muted'}`}>
          <div className="text-xs">正式期限</div>
          {fmtDate(it.due_on)}
        </div>
      </div>
      <Link href={`/tasks/item?id=${encodeURIComponent(it.task_id)}`} className="btn-ghost mt-2 min-h-11 text-sm">前往處理</Link>
    </li>
  );
}

export async function MyWork() {
  const sb = getSession()!.sb;
  const { data, error } = await sb.rpc('my_work');
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-soft p-4 text-danger">
        「我的工作」暫時無法載入（{error.message}）。請重新整理；若持續發生請通知主任。
      </p>
    );
  }
  const items = (data ?? []) as MyItem[];
  if (!items.length) {
    return <p className="card p-6 text-center text-muted">目前沒有需要你處理或追蹤的工作。主任核定交辦後，工作會出現在這裡。</p>;
  }
  // 有資料的分區優先完整呈現；零筆的分區收成一張緊湊摘要（仍列出名稱、筆數 0 與說明），順序固定不跳動
  const filled = MY_SECTIONS.map((s) => ({ s, list: items.filter((x) => x.section === s.key) })).filter((x) => x.list.length);
  const empty = MY_SECTIONS.filter((s) => !items.some((x) => x.section === s.key));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {filled.map(({ s, list }) => (
          <section key={s.key} aria-labelledby={`my-${s.key}`} className={`card border-t-4 ${s.tone} p-4`}>
            <h2 id={`my-${s.key}`} className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{s.label}</span>
              <span data-count={list.length} className="text-2xl font-bold tabular-nums" aria-label={`${list.length} 項`}>{list.length}</span>
            </h2>
            <ul className="divide-y divide-line">{list.map((it) => <Item key={it.task_id} it={it} />)}</ul>
          </section>
        ))}
      </div>
      {empty.length > 0 && (
        <section aria-label="目前沒有項目的分區" data-empty-sections className="card px-4 py-2">
          <ul className="divide-y divide-line">
            {empty.map((s) => (
              <li key={s.key} data-section={s.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><span className="font-medium">{s.label}</span><span className="ml-2 text-xs text-muted">{s.empty}</span></span>
                <span className="tabular-nums text-muted" aria-label="0 項">0</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function MyWorkSkeleton() {
  return (
    <div role="status" aria-live="polite" data-loading className="space-y-4">
      {/* 與載入後的版面相近（一張分區卡＋緊湊摘要），減少載入完成時的跳動 */}
      <div className="card h-40 animate-pulse p-4"><div className="font-semibold text-muted">我的工作</div></div>
      <div className="card animate-pulse px-4 py-2">
        {MY_SECTIONS.map((s) => <div key={s.key} className="py-2 text-sm text-muted">{s.label}</div>)}
      </div>
      <span className="sr-only">我的工作載入中…</span>
    </div>
  );
}
