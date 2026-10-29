'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { redirect } from '@/lib/session';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { fmtDate } from '@/lib/format';
import type { TaskRow } from '@/lib/types';

const COLS = [
  { key: 'draft', label: '待主任核定（草案）', test: (t: TaskRow) => t.approval_status !== '已核定' && t.status !== '已取消' },
  { key: '待處理', label: '待處理', test: (t: TaskRow) => t.approval_status === '已核定' && t.status === '待處理' },
  { key: '進行中', label: '進行中', test: (t: TaskRow) => t.status === '進行中' },
  { key: '受阻', label: '受阻', test: (t: TaskRow) => t.status === '受阻' },
  { key: '待外部回覆', label: '待外部回覆', test: (t: TaskRow) => t.status === '待外部回覆' },
  { key: '待主管核定', label: '待主管核定', test: (t: TaskRow) => t.status === '待主管核定' },
  { key: '已結案', label: '已結案', test: (t: TaskRow) => t.status === '已結案' },
];

async function Board({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const { by } = await searchParams;
  const { me, sb } = await requireMe();
  if (!me.is_director && !me.roles.some((r) => r.role === 'eval_coordinator')) redirect('/no-access?reason=director');
  const { data } = await sb.from('v_tasks').select('*').eq('department_id', 'D02').not('indicator_ids', 'is', null).order('due_on');
  const tasks = (data ?? []) as TaskRow[];
  const owners = [...new Map(tasks.map((t) => [t.owner_person_id ?? '-', t.owner_name ?? '未指派'])).entries()];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">教保組評鑑追蹤</h1>
          <p className="text-sm text-muted">
            評鑑統籌負責協調、催辦、彙報主任；不是代理組長，沒有核定與人事權限。留職停薪的同仁不派工、不通知。
            共 {tasks.length} 項，草案 {tasks.filter(COLS[0].test).length} 項待主任核定。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/evaluation/board" className={!by ? 'btn-primary' : 'btn-ghost'}>依狀態</Link>
          <Link href="/evaluation/board?by=owner" className={by === 'owner' ? 'btn-primary' : 'btn-ghost'}>依承辦人</Link>
        </div>
      </header>
      {by === 'owner' ? (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="bg-paper"><tr><th className="th">承辦人</th>{COLS.map((c) => <th key={c.key} className="th text-right">{c.label}</th>)}<th className="th text-right">逾期</th></tr></thead>
            <tbody className="divide-y divide-line">{owners.map(([pid, name]) => {
              const mine = tasks.filter((t) => (t.owner_person_id ?? '-') === pid);
              return <tr key={pid}><td className="td"><Link className="hover:underline" href={`/tasks?owner=${pid}`}>{name}</Link></td>{COLS.map((c) => <td key={c.key} className="td text-right tabular-nums">{mine.filter(c.test).length || ''}</td>)}<td className="td text-right tabular-nums text-danger">{mine.filter((t) => t.is_overdue && t.approval_status === '已核定').length || ''}</td></tr>;
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLS.map((c) => {
            const items = tasks.filter(c.test);
            return (
              <section key={c.key} className="w-72 shrink-0 rounded-xl bg-line/40 p-2" aria-label={c.label}>
                <h2 className="mb-2 flex justify-between px-1 text-sm font-semibold"><span>{c.label}</span><span className="text-muted">{items.length}</span></h2>
                <ul className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">{items.map((t) => (
                  <li key={t.id} className="card p-2.5 text-sm">
                    <Link href={`/tasks/item?id=${encodeURIComponent(t.id)}`} className="font-medium hover:underline">{t.title}</Link>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted"><span>{t.indicator_ids?.join('、')}</span><span>・{t.owner_name}</span><span>・{fmtDate(t.due_on)}</span>{t.priority === '高' && <Badge>高</Badge>}{t.is_overdue && t.approval_status === '已核定' && <Badge tone="逾期">逾期</Badge>}</div>
                  </li>
                ))}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Board as PageLoader} title="教保評鑑追蹤" />;
}
