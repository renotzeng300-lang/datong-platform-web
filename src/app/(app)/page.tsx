'use client';
import { AsyncView, Async, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { dueLabel, fmtDate, todayTaipei } from '@/lib/format';
import type { TaskRow } from '@/lib/types';
import { DirectorBoard, DirectorBoardSkeleton } from '@/components/DirectorBoard';
import { MyWork, MyWorkSkeleton } from '@/components/MyWork';

type Summary = Record<string, number> & {
  today: string;
  by_department: { department_id: string; department_name: string; open: number; overdue: number; awaiting_approval: number }[];
  by_owner: { person_id: string; name: string; open: number; overdue: number; awaiting_approval: number }[];
};

function Kpi({ label, value, href, tone = 'neutral', note }: { label: string; value: number; href: string; tone?: 'danger' | 'warn' | 'hold' | 'neutral' | 'ok'; note?: string }) {
  const toneCls = { danger: 'border-l-danger', warn: 'border-l-warn', hold: 'border-l-hold', neutral: 'border-l-line', ok: 'border-l-ok' }[tone];
  return (
    <Link href={href} className={`card block border-l-4 ${toneCls} p-4 transition hover:shadow-sm`}>
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${value > 0 && tone === 'danger' ? 'text-danger' : ''}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </Link>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ department?: string; person?: string; indicator?: string }> }) {
  const sp = await searchParams;
  const { me, sb } = await requireMe();
  const params = { p_department: sp.department || null, p_person: sp.person || null, p_indicator: sp.indicator || null };
  const showBoard = me.is_director || me.roles.some((r) => r.role === 'dept_lead');
  const isLead = me.roles.some((r) => r.role === 'dept_lead');
  if (!me.is_director && !isLead) {
    // 一般同仁、協作人員、評鑑統籌：首頁就是「我的工作」
    return (
      <div className="space-y-6">
        <header>
          <div className="text-sm text-muted">今天 {fmtDate(todayTaipei())}（民國 {fmtDate(todayTaipei(), true)}）</div>
          <h1 className="h1">{me.name}，你好</h1>
          <p className="text-sm text-muted">以下是你負責或協作的工作。「我是主責」代表由你負責完成與申請結案；「我是協作」代表你協助主責。</p>
        </header>
        <Async of={MyWork} fallback={<MyWorkSkeleton />} />
        <p className="text-sm"><Link href="/tasks?filter=mine" className="text-accent">查看我負責的全部工作 →</Link></p>
      </div>
    );
  }
  const [{ data: s }, { data: depts }, { data: people }, { data: soon }] = await Promise.all([
    sb.rpc('dashboard_summary', params),
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    me.is_director ? sb.rpc('assignable_people') : Promise.resolve({ data: [] }),
    sb.from('v_tasks').select('*').not('status', 'in', '("已結案","已取消")').in('approval_status', ['已核定', '免核定'])
      .order('due_on', { ascending: true, nullsFirst: false }).limit(8),
  ]);
  const sum = s as Summary;
  const qs = (extra: Record<string, string>) => '/tasks?' + new URLSearchParams({ ...(sp.department ? { department: sp.department } : {}), ...(sp.person ? { owner: sp.person } : {}), ...(sp.indicator ? { indicator: sp.indicator } : {}), ...extra }).toString();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted">今天 {fmtDate(sum.today)}（民國 {fmtDate(sum.today, true)}）</div>
          <h1 className="h1">{me.is_director ? '主任儀表板' : `${me.name}，你好`}</h1>
          {!me.is_director && <p className="text-sm text-muted">以下只統計你負責或協作的工作。</p>}
        </div>
        {me.is_director && (
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="label" htmlFor="department">組別</label>
              <select id="department" name="department" defaultValue={sp.department ?? ''} className="field">
                <option value="">全部組別</option>
                {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="person">承辦人</label>
              <select id="person" name="person" defaultValue={sp.person ?? ''} className="field">
                <option value="">全部同仁</option>
                {(people ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="indicator">指標</label>
              <input id="indicator" name="indicator" defaultValue={sp.indicator ?? ''} placeholder="例 4101" className="field w-28" />
            </div>
            <button className="btn-ghost">套用</button>
          </form>
        )}
      </header>

      {isLead && !me.is_director && (
        <section aria-labelledby="mine" className="space-y-3">
          <h2 id="mine" className="h2">我的工作</h2>
          <Async of={MyWork} fallback={<MyWorkSkeleton />} />
        </section>
      )}

      {showBoard && (
        <section aria-labelledby="board" className="space-y-3">
          <h2 id="board" className="h2">今天的重點</h2>
          <Async of={DirectorBoard} fallback={<DirectorBoardSkeleton />} />
        </section>
      )}

      <section aria-labelledby="k1">
        <h2 id="k1" className="h2 mb-3">需要注意</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Kpi label="已逾期" value={sum.overdue} href={qs({ filter: 'overdue' })} tone="danger" />
          <Kpi label="今天到期" value={sum.due_today} href={qs({ filter: 'due7' })} tone="warn" />
          <Kpi label="7 日內到期" value={sum.due_in_7} href={qs({ filter: 'due7' })} tone="warn" />
          <Kpi label="14 日內到期" value={sum.due_in_14} href={qs({ filter: 'due14' })} />
          <Kpi label="待外部回覆" value={sum.waiting_external} href={qs({ filter: 'external' })} tone="warn" />
          <Kpi label="超過 7 日未更新" value={sum.stale_7_days} href={qs({ filter: 'stale' })} tone="warn" />
          <Kpi label="待主任核定交辦" value={sum.awaiting_assignment_approval} href={qs({ filter: 'awaiting_approval' })} tone="hold" note="草案，尚未正式交辦" />
          <Kpi label="待核定結案" value={sum.awaiting_close_approval} href={qs({ filter: 'awaiting_close' })} tone="hold" />
          <Kpi label="無主責人" value={sum.no_owner} href={qs({ filter: 'no_owner' })} tone="danger" />
          <Kpi label="待交接" value={sum.needs_handoff} href={qs({ filter: 'handoff' })} tone="danger" note="主責留停／離職" />
          <Kpi label="進行中正式工作" value={sum.formal_open} href={qs({ filter: 'formal' })} tone="ok" />
          {me.is_director && <Kpi label="所有待核定申請" value={sum.pending_decisions} href="/approvals" tone="hold" />}
        </div>
      </section>

      <section aria-labelledby="k2">
        <h2 id="k2" className="h2 mb-1">第12次評鑑準備</h2>
        <p className="mb-3 text-sm text-muted">以下是內部盤點進度，不是官方評鑑分數。「佐證齊備」「標準符合」「正式得分」分開認定。</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="指標分項" value={sum.indicators_total} href="/evaluation" />
          <Kpi label="尚未盤點" value={sum.indicators_not_started} href="/evaluation?status=尚未盤點" tone="warn" />
          <Kpi label="適用性待確認" value={sum.indicators_applicability_unconfirmed} href="/evaluation?applicability=待確認" tone="hold" note="需依立案類別與主管機關程序確認" />
          <Kpi label="分工待主任核定" value={sum.assignments_pending_approval} href="/evaluation?assignment=待主任核定" tone="hold" />
          <Kpi label="年度佐證待盤點" value={sum.year_reviews_pending} href="/evaluation" tone="warn" note={`共 ${sum.year_reviews_total} 筆年度盤點`} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden" aria-labelledby="soon">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="soon" className="h2">最近到期的正式工作</h2>
            <Link href="/tasks?filter=formal" className="text-sm text-accent">全部 →</Link>
          </div>
          <ul className="divide-y divide-line">
            {(soon as TaskRow[] | null)?.length ? (soon as TaskRow[]).map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/tasks/item?id=${encodeURIComponent(t.id)}`} className="font-medium hover:underline">{t.title}</Link>
                  <div className="text-xs text-muted">{t.owner_name ?? '未指派'}・{t.department_name}・<Badge>{t.status}</Badge></div>
                </div>
                <div className={`shrink-0 text-right text-sm ${t.is_overdue ? 'text-danger font-semibold' : 'text-muted'}`}>
                  {fmtDate(t.due_on)}<div className="text-xs">{dueLabel(t.days_to_due, false)}</div>
                </div>
              </li>
            )) : <li className="px-4 py-6 text-sm text-muted">目前沒有已核定交辦的進行中工作。匯入的 V5 任務仍待主任核定。</li>}
          </ul>
        </section>

        {me.is_director && (
          <section className="card overflow-hidden" aria-labelledby="byowner">
            <h2 id="byowner" className="h2 border-b border-line px-4 py-3">依組別／承辦人</h2>
            <table className="w-full">
              <thead className="bg-paper"><tr><th className="th">組別</th><th className="th text-right">未結</th><th className="th text-right">逾期</th><th className="th text-right">待核定</th></tr></thead>
              <tbody className="divide-y divide-line">
                {sum.by_department.map((d) => (
                  <tr key={d.department_id}><td className="td"><Link className="hover:underline" href={`/tasks?department=${d.department_id}`}>{d.department_name}</Link></td>
                    <td className="td text-right tabular-nums">{d.open}</td><td className={`td text-right tabular-nums ${d.overdue ? 'text-danger font-semibold' : ''}`}>{d.overdue}</td><td className="td text-right tabular-nums">{d.awaiting_approval}</td></tr>
                ))}
              </tbody>
            </table>
            <table className="w-full border-t border-line">
              <thead className="bg-paper"><tr><th className="th">承辦人</th><th className="th text-right">未結</th><th className="th text-right">逾期</th><th className="th text-right">待核定</th></tr></thead>
              <tbody className="divide-y divide-line">
                {sum.by_owner.map((o) => (
                  <tr key={o.person_id}><td className="td"><Link className="hover:underline" href={`/tasks?owner=${o.person_id}`}>{o.name}</Link></td>
                    <td className="td text-right tabular-nums">{o.open}</td><td className={`td text-right tabular-nums ${o.overdue ? 'text-danger font-semibold' : ''}`}>{o.overdue}</td><td className="td text-right tabular-nums">{o.awaiting_approval}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Dashboard as PageLoader} title="儀表板" />;
}
