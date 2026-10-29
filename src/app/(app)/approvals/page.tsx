'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { redirect } from '@/lib/session';
import { requireMe, hasRole } from '@/lib/session';
import { ActionForm, Submit } from '@/components/ActionForm';
import { Badge } from '@/components/Badge';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { annotateDecision, approveMany, resolveDecision } from '../tasks/actions';

export type QueueItem = {
  decision_id: number; kind: string; entity_type: string; entity_id: string;
  requested_by: string | null; requested_by_name: string | null; requested_at: string; waiting_days: number;
  task_title: string | null; task_status: string | null; task_approval_status: string | null; task_due_on: string | null;
  task_owner_person_id: string | null; task_owner_name: string | null; task_owner_assignable: boolean; department_name: string | null;
  risk_rank: number; risk_level: string; risk_reasons: string[];
  reason: string | null; proposal: string | null; impact_if_delayed: string | null;
  before_value: Record<string, string> | null; after_value: Record<string, string> | null;
};

const KINDS = ['交辦核定', '結案核定', '期限變更', '協調事項', '提案', '標準修訂'];
const RISK_TONE: Record<string, string> = { 高: '逾期', 中: '高', 低: '', '—': '' };
const ENTITY_LABEL: Record<string, string> = { evaluation_assignment: '評鑑分工', person: '人事', import_batch: '匯入批次', case: '案件',
  evaluation_criterion: '官方標準', evaluation_indicator: '評鑑指標', finding: '缺失' };
// 官方標準 ID 形如 EV12-4206-S1 → 指標 4206
const indicatorOfCriterion = (id: string) => id.replace(/^EV12-/, '').replace(/-[SN]\d+$/, '');

function Waiting({ days }: { days: number }) {
  return (
    <span className={`whitespace-nowrap text-sm ${days >= 7 ? 'font-semibold text-danger' : days >= 3 ? 'text-warn' : 'text-muted'}`}
          title="以臺北時區日曆日計算：今天日期 − 送件日期">
      等待 {days} 日
    </span>
  );
}

function Card({ r }: { r: QueueItem }) {
  const isTask = r.entity_type === 'task';
  const approveBlocked = r.kind === '交辦核定' && !r.task_owner_assignable;
  return (
    <li className={`card p-4 ${r.risk_rank === 3 ? 'border-l-4 border-l-danger' : r.risk_rank === 2 ? 'border-l-4 border-l-warn' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="待主任核定">{r.kind}</Badge>
            {isTask && <Badge tone={RISK_TONE[r.risk_level]}>{`風險 ${r.risk_level}`}</Badge>}
            {r.risk_reasons?.map((x) => <span key={x} className="text-xs text-danger">{x}</span>)}
          </div>
          <div className="font-medium">
            {isTask
              ? <Link href={`/tasks/item?id=${encodeURIComponent(r.entity_id)}`} className="hover:underline">{r.task_title}</Link>
              : r.entity_type === 'evaluation_criterion'
                ? <Link href={`/evaluation/item?id=${encodeURIComponent(indicatorOfCriterion(r.entity_id))}#${r.entity_id}`} className="hover:underline">{ENTITY_LABEL[r.entity_type]} {r.entity_id}</Link>
                : <span>{ENTITY_LABEL[r.entity_type] ?? r.entity_type} {r.entity_id}</span>}
          </div>
          <div className="text-xs text-muted">
            {r.requested_by_name ?? '系統'} 於 {fmtDateTime(r.requested_at)} 送出
            {isTask && <>・{r.department_name}・主責 {r.task_owner_name ?? '未指定'}・{r.task_status}・期限 {fmtDate(r.task_due_on)}</>}
          </div>
        </div>
        <Waiting days={r.waiting_days} />
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">申請理由</dt><dd className="min-w-0 whitespace-pre-wrap">{r.reason || (r.kind === '交辦核定' ? '（工作提報或匯入，待核定交辦）' : '—')}</dd></div>
        {r.kind === '標準修訂' && (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-line p-2"><div className="text-xs text-muted">現行原文</div><p className="whitespace-pre-wrap">{r.before_value?.text}</p></div>
            <div className="rounded-lg border border-accent p-2"><div className="text-xs text-muted">建議修訂為</div><p className="whitespace-pre-wrap">{r.after_value?.text}</p></div>
          </div>
        )}
        {r.kind === '期限變更' && <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">期限</dt><dd>{r.before_value?.due_on ?? '—'} → <b>{r.after_value?.due_on}</b></dd></div>}
        <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">建議方案</dt><dd className="min-w-0 whitespace-pre-wrap">{r.proposal ?? <span className="text-muted">未提供</span>}</dd></div>
        <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">延後影響</dt><dd className="min-w-0 whitespace-pre-wrap">{r.impact_if_delayed ?? <span className="text-muted">未提供</span>}</dd></div>
      </dl>

      {(!r.proposal || !r.impact_if_delayed) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-accent">補充建議方案／延後影響</summary>
          <ActionForm action={annotateDecision} className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <input type="hidden" name="decision_id" value={r.decision_id} />
            <div><label className="label" htmlFor={`p${r.decision_id}`}>建議方案</label><input id={`p${r.decision_id}`} name="proposal" maxLength={1000} className="field" defaultValue={r.proposal ?? ''} /></div>
            <div><label className="label" htmlFor={`i${r.decision_id}`}>延後決策的影響</label><input id={`i${r.decision_id}`} name="impact" maxLength={1000} className="field" defaultValue={r.impact_if_delayed ?? ''} /></div>
            <Submit variant="ghost">儲存</Submit>
          </ActionForm>
        </details>
      )}

      <ActionForm action={resolveDecision} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
                  confirm={r.kind === '結案核定' ? '確定處理這筆結案申請？' : undefined}>
        <input type="hidden" name="decision_id" value={r.decision_id} />
        <input type="hidden" name="task_id" value={isTask ? r.entity_id : ''} />
        <div className="grow"><label className="label" htmlFor={`n${r.decision_id}`}>意見</label><input id={`n${r.decision_id}`} name="note" className="field" /></div>
        {approveBlocked
          ? <span className="text-sm text-danger">{r.task_owner_person_id ? '建議主責尚未確認在職，' : '尚未指定主責，'}請先檢視並指定</span>
          : <Submit name="result" value="核定">{r.kind === '提案' || r.kind === '協調事項' ? '裁示／採納' : r.kind === '結案核定' ? '核定結案' : '核定'}</Submit>}
        <Submit name="result" value="退回" variant="ghost">退回</Submit>
        {isTask && <Link href={`/tasks/item?id=${encodeURIComponent(r.entity_id)}`} className="btn-ghost">檢視</Link>}
      </ActionForm>
    </li>
  );
}

async function DecisionQueue({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const { me, sb } = await requireMe();
  if (!me.is_director && !hasRole(me, 'dept_lead')) redirect('/no-access?reason=director');
  const { data, error } = await sb.rpc('decision_queue');
  const all = (data ?? []) as QueueItem[];
  const active = kind && (KINDS.includes(kind) || kind === '其他') ? kind : '';
  const list = active === '其他' ? all.filter((r) => !KINDS.includes(r.kind)) : active ? all.filter((r) => r.kind === active) : all;
  const others = all.filter((r) => !KINDS.includes(r.kind)).length;
  const high = all.filter((r) => r.risk_rank === 3).length;
  const oldest = all.reduce((m, r) => Math.max(m, r.waiting_days), 0);
  const bulk = active === '交辦核定' ? list.filter((r) => r.task_owner_assignable) : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="h1">決策佇列</h1>
        <p className="text-sm text-muted">
          只列出你有權處理的申請。排序：風險高者優先，其次等待最久者。等待天數以臺北時區日曆日計算。
          核定、退回都會寫入操作日誌；同一筆不會被重複處理。
        </p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">無法載入決策佇列：{error.message}</p>}

      {!error && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><div className="text-xs text-muted">待處理</div><div className="text-3xl font-semibold tabular-nums">{all.length}</div></div>
          <div className="card p-4"><div className="text-xs text-muted">高風險</div><div className={`text-3xl font-semibold tabular-nums ${high ? 'text-danger' : ''}`}>{high}</div></div>
          <div className="card p-4"><div className="text-xs text-muted">最久等待</div><div className={`text-3xl font-semibold tabular-nums ${oldest >= 7 ? 'text-danger' : ''}`}>{oldest} <span className="text-base">日</span></div></div>
        </section>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="決策類型">
        <Link href="/approvals" className={`rounded-full border px-3 py-1 text-sm ${!active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>全部 <b>{all.length}</b></Link>
        {KINDS.map((g) => (
          <Link key={g} href={`/approvals?kind=${g}`} className={`rounded-full border px-3 py-1 text-sm ${active === g ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>
            {g} <b>{all.filter((r) => r.kind === g).length}</b>
          </Link>
        ))}
        {others > 0 && <Link href="/approvals?kind=其他" className={`rounded-full border px-3 py-1 text-sm ${active === '其他' ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>其他 <b>{others}</b></Link>}
      </nav>

      {bulk.length > 1 && (
        <ActionForm action={approveMany} confirm="確定核定勾選的工作，並通知主責與協作人員？" className="card overflow-x-auto">
          <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
            <div className="grow"><label className="label" htmlFor="note">批次核定意見（套用到勾選項目）</label><input id="note" name="note" className="field" placeholder="例：同意依建議內控期限執行" /></div>
            <Submit>核定勾選項目</Submit>
          </div>
          <table className="w-full">
            <thead className="bg-paper"><tr><th className="th w-10"><span className="sr-only">選取</span></th><th className="th">工作</th><th className="th">風險</th><th className="th">主責</th><th className="th">建議期限</th><th className="th">等待</th></tr></thead>
            <tbody className="divide-y divide-line">
              {bulk.map((r) => (
                <tr key={r.decision_id}>
                  <td className="td"><input type="checkbox" name="ids" value={r.entity_id} aria-label={`選取 ${r.task_title}`} /></td>
                  <td className="td"><Link href={`/tasks/item?id=${encodeURIComponent(r.entity_id)}`} className="font-medium hover:underline">{r.task_title}</Link><div className="text-xs text-muted">{r.entity_id}</div></td>
                  <td className="td"><Badge tone={RISK_TONE[r.risk_level]}>{r.risk_level}</Badge></td>
                  <td className="td whitespace-nowrap">{r.task_owner_name}</td>
                  <td className="td whitespace-nowrap">{fmtDate(r.task_due_on)}</td>
                  <td className="td whitespace-nowrap tabular-nums">{r.waiting_days} 日</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted">只列出已指定在職主責、可直接核定的交辦；其餘請在下方逐筆檢視。</p>
        </ActionForm>
      )}

      {!error && (
        <ul className="space-y-3">
          {list.map((r) => <Card key={r.decision_id} r={r} />)}
          {!list.length && <li className="card p-6 text-center text-muted">目前沒有待處理的{active || '決策'}。</li>}
        </ul>
      )}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={DecisionQueue as PageLoader} title="決策佇列" />;
}
