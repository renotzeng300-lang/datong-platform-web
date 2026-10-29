'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireMe, hasRole } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { fmtDate, fmtDateTime, todayTaipei } from '@/lib/format';
import { addAction, markActionDone, reviewEffectiveness } from '../actions';

const STEPS = ['待改善', '改善中', '待複核', '已結案'];

async function FindingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, sb } = await requireMe();
  const { data: f } = await sb.from('v_findings').select('*').eq('id', id).maybeSingle();
  if (!f) notFound();
  const canManage = me.is_director || hasRole(me, 'dept_lead', f.department_id ?? undefined);
  const [{ data: actions }, { data: reviews }, { data: people }] = await Promise.all([
    sb.from('improvement_actions').select('*').eq('finding_id', id).order('id'),
    sb.from('effectiveness_reviews').select('*').eq('finding_id', id).order('id'),
    canManage ? sb.rpc('assignable_people') : Promise.resolve({ data: [] }),
  ]);
  const ids = [...new Set([...(actions ?? []).flatMap((a) => [a.owner_person_id, a.done_by]), ...(reviews ?? []).map((r) => r.reviewer_person_id)].filter(Boolean))];
  const { data: names } = ids.length ? await sb.from('people').select('id,name').in('id', ids) : { data: [] };
  const nm = new Map((names ?? []).map((p) => [p.id, p.name]));
  const step = STEPS.indexOf(f.status);
  const today = todayTaipei();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/improvements" className="text-sm text-accent">← 缺失與改善</Link>
        <h1 className="h1 mt-1">{f.summary}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge>{f.status}</Badge><span>{f.id}</span><span>來源：{f.source}</span><span>發現：{fmtDate(f.found_on)}</span>
          <span>{f.department_name}</span>{f.risk_level && <span>風險 {f.risk_level}</span>}
          {f.indicator_id && <Link href={`/evaluation/item?id=${encodeURIComponent(f.indicator_id)}`} className="text-accent">指標 {f.indicator_id}</Link>}
          <span>提報：{f.created_by_name}</span>
        </div>
        {f.root_cause && <p className="mt-2 text-sm"><span className="text-muted">可能原因：</span>{f.root_cause}</p>}
      </div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="改善流程">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined}
              className={`rounded-full border px-3 py-1 ${i === step ? 'border-accent bg-accent text-on-accent' : i < step ? 'border-ok text-ok' : 'border-line text-muted'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="ahead">
        <h2 id="ahead" className="h2 border-b border-line px-4 py-3">改善措施</h2>
        <ul className="divide-y divide-line">{(actions ?? []).map((a) => {
          const mine = a.owner_person_id === me.person_id;
          const overdue = !a.done_on && a.due_on && a.due_on < today;
          return (
            <li key={a.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-medium">{a.action}</div>
                  <div className="text-xs text-muted">主責 {nm.get(a.owner_person_id) ?? a.owner_person_id}・期限 <span className={overdue ? 'font-semibold text-danger' : ''}>{fmtDate(a.due_on)}{overdue && '（逾期）'}</span>
                    {a.task_id && <>・<Link href={`/tasks/item?id=${encodeURIComponent(a.task_id)}`} className="text-accent">任務 {a.task_id}</Link></>}</div></div>
                {a.done_on ? <Badge tone="已結案">{`完成 ${fmtDate(a.done_on)}`}</Badge> : <Badge tone="進行中">進行中</Badge>}
              </div>
              {a.done_note && <p className="mt-1 text-sm"><span className="text-muted">完成情形（{nm.get(a.done_by) ?? ''}）：</span>{a.done_note}</p>}
              {!a.done_on && (mine || canManage) && (
                <ActionForm action={markActionDone} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="action" value={a.id} /><input type="hidden" name="finding" value={id} /><input type="hidden" name="indicator" value={f.indicator_id ?? ''} />
                  <div className="grow"><label className="label" htmlFor={`dn-${a.id}`}>完成情形與佐證位置</label><input id={`dn-${a.id}`} name="note" required className="field" /></div>
                  <Submit>回報完成</Submit>
                </ActionForm>
              )}
            </li>
          );
        })}{!actions?.length && <li className="px-4 py-4 text-sm text-muted">尚未安排改善措施。</li>}</ul>
        {canManage && f.status !== '已結案' && (
          <div className="border-t border-line px-4 py-3 text-sm">
            <h3 className="font-medium">新增改善措施</h3>
            <ActionForm action={addAction} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input type="hidden" name="finding" value={id} /><input type="hidden" name="indicator" value={f.indicator_id ?? ''} />
              <div className="sm:col-span-2"><label className="label" htmlFor="na">措施內容</label><input id="na" name="action" required className="field" /></div>
              <div><label className="label" htmlFor="no">主責（唯一）</label>
                <select id="no" name="owner" required className="field" defaultValue="">
                  <option value="" disabled>請選擇</option>
                  {((people ?? []) as { id: string; name: string; title: string }[]).map((p) => <option key={p.id} value={p.id}>{p.name}｜{p.title}</option>)}
                </select><p className="hint">只列在職同仁；留職停薪者不會出現。</p></div>
              <div><label className="label" htmlFor="nd">期限</label><input id="nd" name="due" type="date" required className="field" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="nt">關聯任務編號（選填）</label><input id="nt" name="task" className="field" placeholder="例：T20261028-0001" /></div>
              <div className="sm:col-span-2"><Submit>新增並通知主責</Submit></div>
            </ActionForm>
          </div>
        )}
      </section>

      <section className="card p-5" aria-labelledby="rhead">
        <h2 id="rhead" className="h2 mb-1">成效複核</h2>
        <p className="mb-3 text-sm text-muted">所有措施完成後，由主任觀察實際成效。「有效」才結案；「部分有效／無效」會退回改善中，需再安排措施。</p>
        <ul className="space-y-1 text-sm">{(reviews ?? []).map((r) => (
          <li key={r.id}><Badge>{r.result}</Badge>　{fmtDate(r.reviewed_on)}・{nm.get(r.reviewer_person_id) ?? ''}：{r.note}</li>
        ))}{!reviews?.length && <li className="text-muted">尚無複核紀錄</li>}</ul>
        {f.status === '已結案' && <p className="mt-2 text-sm text-ok">已於 {fmtDateTime(f.closed_at)} 結案。</p>}
        {me.is_director && f.status === '待複核' && (
          <ActionForm action={reviewEffectiveness} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="finding" value={id} /><input type="hidden" name="indicator" value={f.indicator_id ?? ''} />
            <div className="grow"><label className="label" htmlFor="rn">複核方式與觀察結果</label><input id="rn" name="note" required className="field" placeholder="例：抽查 4 週排班紀錄均依表執行" /></div>
            <Submit name="result" value="有效">有效，結案</Submit>
            <Submit name="result" value="部分有效" variant="ghost">部分有效</Submit>
            <Submit name="result" value="無效" variant="ghost">無效</Submit>
          </ActionForm>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={FindingDetail as PageLoader} title="缺失詳情" />;
}
