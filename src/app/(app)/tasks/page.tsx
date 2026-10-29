'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { DownloadButton } from '@/components/DownloadButton';
import Link from 'next/link';
import { requireMe, hasRole } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { dueLabel, fmtDate, TASK_STATUSES } from '@/lib/format';
import type { TaskRow } from '@/lib/types';
import { applyTaskFilters, searchToQuery, TASK_FILTERS, type TaskSearch } from '@/lib/taskFilters';

const FILTERS = TASK_FILTERS;

async function Tasks({ searchParams }: { searchParams: Promise<TaskSearch> }) {
  const sp = await searchParams;
  const { me, sb } = await requireMe();
  let q = sb.from('v_tasks').select('*').order('due_on', { ascending: true, nullsFirst: false }).order('id').limit(500);
  q = applyTaskFilters(q, sp, me);
  const [{ data, error }, { data: depts }] = await Promise.all([q, sb.from('departments').select('id,name').order('id')]);
  const rows = (data ?? []) as TaskRow[];
  const canCreate = true; // 所有在職同仁可「提報」；主任／組長可直接交辦（伺服器端判斷）
  const canManage = me.is_director || hasRole(me, 'dept_lead');

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">工作管理</h1>
          <p className="text-sm text-muted">{sp.filter ? `篩選：${FILTERS[sp.filter] ?? sp.filter}` : '你有權限看到的所有工作'}・共 {rows.length} 筆</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadButton job={{ kind: 'tasks', search: sp }}>⬇ 匯出 Excel</DownloadButton>
          {canManage && <Link href="/tasks/import" className="btn-ghost">⬆ 批量匯入</Link>}
          {canCreate && <Link href="/tasks/new" className="btn-primary">{canManage ? '＋ 新增工作' : '＋ 提報工作'}</Link>}
        </div>
      </header>

      {(() => {
        // 切換快速篩選時保留關鍵字、組別、狀態等其他條件；有其他條件時明確提示並提供清除
        const others = { ...sp, filter: undefined };
        const kept = (['q', 'department', 'status', 'indicator', 'owner'] as const).filter((k) => sp[k]);
        const chip = (active: boolean) => `inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-4 text-sm ${active ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-card hover:border-accent'}`;
        return (
          <nav aria-label="快速篩選" className="space-y-2">
            <ul className="flex flex-wrap gap-2">
              <li><Link href={`/tasks${searchToQuery(others)}`} aria-current={!sp.filter ? 'page' : undefined} className={chip(!sp.filter)}>{!sp.filter && <span aria-hidden>✓</span>}全部</Link></li>
              {Object.entries(FILTERS).map(([k, v]) => (
                <li key={k}><Link href={`/tasks${searchToQuery({ ...sp, filter: k })}`} aria-current={sp.filter === k ? 'page' : undefined} className={chip(sp.filter === k)}>{sp.filter === k && <span aria-hidden>✓</span>}{v}</Link></li>
              ))}
            </ul>
            {kept.length > 0 && (
              <p className="text-xs text-muted" data-kept-filters>
                切換快速篩選時會保留：{kept.map((k) => ({ q: '關鍵字', department: '組別', status: '狀態', indicator: '指標', owner: '主責' })[k]).join('、')}・
                <Link href={sp.filter ? `/tasks?filter=${sp.filter}` : '/tasks'} className="inline-flex min-h-11 items-center px-1 text-accent underline">清除其他條件</Link>
              </p>
            )}
          </nav>
        );
      })()}

      <form method="get" className="card flex flex-wrap items-end gap-3 p-3">
        {sp.filter && <input type="hidden" name="filter" value={sp.filter} />}
        <div className="grow"><label className="label" htmlFor="q">關鍵字</label><input id="q" name="q" defaultValue={sp.q} className="field" placeholder="工作名稱" /></div>
        <div><label className="label" htmlFor="department">組別</label>
          <select id="department" name="department" defaultValue={sp.department ?? ''} className="field">
            <option value="">全部</option>{(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="status">狀態</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''} className="field">
            <option value="">全部</option>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select></div>
        <div><label className="label" htmlFor="indicator">指標</label><input id="indicator" name="indicator" defaultValue={sp.indicator} className="field w-28" placeholder="例 4101" /></div>
        <button className="btn-ghost">搜尋</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">{error.message}</p>}

      <div className="card hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead className="border-b border-line bg-paper">
            <tr><th className="th">工作</th><th className="th">主責</th><th className="th">組別</th><th className="th">狀態</th><th className="th">主任核定</th><th className="th">期限</th><th className="th">下次追蹤</th><th className="th">指標</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((t) => {
              const closed = ['已結案', '已取消'].includes(t.status);
              return (
                <tr key={t.id} className="hover:bg-paper/60">
                  <td className="td max-w-md"><Link href={`/tasks/item?id=${encodeURIComponent(t.id)}`} className="font-medium hover:underline">{t.title}</Link>
                    <div className="text-xs text-muted">{t.id}{t.needs_handoff && <> ・<span className="text-danger">待交接</span></>}{t.sensitivity !== '一般內部' && <> ・{t.sensitivity}</>}</div></td>
                  <td className="td whitespace-nowrap">{t.owner_name ?? <span className="text-danger">未指派</span>}</td>
                  <td className="td whitespace-nowrap">{t.department_name}</td>
                  <td className="td"><Badge>{t.status}</Badge></td>
                  <td className="td"><Badge>{t.approval_status}</Badge></td>
                  <td className={`td whitespace-nowrap ${t.is_overdue && !closed ? 'font-semibold text-danger' : ''}`}>{fmtDate(t.due_on)}<div className="text-xs">{t.approval_status === '待主任核定' ? '建議期限' : dueLabel(t.days_to_due, closed)}</div></td>
                  <td className="td whitespace-nowrap">{fmtDate(t.next_followup_on)}</td>
                  <td className="td text-sm">{t.indicator_ids?.join('、') ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-muted">沒有符合條件的工作。</p>}
      </div>

      <ul className="space-y-2 lg:hidden">
        {rows.map((t) => (
          <li key={t.id} className="card p-3">
            <Link href={`/tasks/item?id=${encodeURIComponent(t.id)}`} className="font-medium">{t.title}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Badge>{t.status}</Badge><Badge>{t.approval_status}</Badge>
              <span>{t.owner_name ?? '未指派'}</span><span>・期限 {fmtDate(t.due_on)}</span>
              {t.is_overdue && <Badge tone="逾期">逾期</Badge>}
            </div>
          </li>
        ))}
        {!rows.length && <li className="card p-6 text-center text-muted">沒有符合條件的工作。</li>}
      </ul>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Tasks as PageLoader} title="工作管理" />;
}
