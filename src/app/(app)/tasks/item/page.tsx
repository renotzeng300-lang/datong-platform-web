'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { dueLabel, fmtDate, fmtDateTime, todayTaipei } from '@/lib/format';
import { ReportPanel } from './ReportPanel';
import { ResubmitForm } from './ResubmitForm';
import type { TaskRow } from '@/lib/types';
import { deriveFlow, decisionNote, roleOf, FLOW_TONE, type DecisionLite } from '@/lib/flow';
import { setRisk, approveTask, assignTask, cancelTask, changeDue, closeTask, nudgeTask, proposeToDirector, resolveDecision } from '../actions';

type Update = { id: number; author_name: string | null; body: string | null; done_items: string | null; difficulties: string | null; next_action: string | null; status_from: string | null; status_to: string | null; next_followup_on: string | null; created_at: string;
  kind: '進度回報' | '系統紀錄' | null; next_action_due_on: string | null; support_request: string | null; support_type: string | null;
  report_type?: string | null; support_needed_by?: string | null; acceptance_confirmed?: boolean | null; result_link?: string | null; evidence_note?: string | null };
type RiskChange = { id: number; from_category: string | null; to_category: string | null; from_severity: string | null; to_severity: string | null; reason: string; changed_by: string; changed_at: string };
type Decision = DecisionLite;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5">{children ?? '—'}</dd></div>;
}

function Row({ label, danger, children }: { label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className={`w-24 shrink-0 ${danger ? 'font-semibold text-danger' : 'text-muted'}`}>{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

async function TaskDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; decided?: string }> }) {
  const { id } = await params;
  const { created, decided } = await searchParams;
  const { me, sb } = await requireMe();
  const { data: t } = await sb.from('v_tasks').select('*').eq('id', id).maybeSingle<TaskRow>();
  if (!t) notFound();
  const [{ data: updates }, { data: decisions }, { data: links }, { data: collabs }, { data: people }, { data: riskLog }] = await Promise.all([
    sb.from('v_task_updates').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    sb.from('decisions').select('*').eq('entity_type', 'task').eq('entity_id', id).order('requested_at', { ascending: false }),
    sb.from('task_indicator_links').select('indicator_id, reason, check_status').eq('task_id', id),
    sb.from('task_collaborators').select('person_id, kind').eq('task_id', id).is('removed_at', null),
    sb.rpc('assignable_people'),
    sb.from('task_risk_changes').select('*').eq('task_id', id).order('changed_at', { ascending: false }),
  ]);
  const { data: inds } = links?.length
    ? await sb.from('evaluation_indicators').select('id,name').in('id', links.map((l) => l.indicator_id))
    : { data: [] as { id: string; name: string }[] };
  const indName = new Map((inds ?? []).map((i) => [i.id, i.name]));
  const assignable = (people ?? []) as { id: string; name: string; title: string; department_id: string }[];

  const isDirector = me.is_director;
  const isLead = me.roles.some((r) => r.role === 'dept_lead' && r.department_id === t.department_id);
  const canManage = isDirector || isLead;
  const isMember = t.owner_person_id === me.person_id || (collabs ?? []).some((c) => c.person_id === me.person_id);
  const isCoord = t.coordinator_person_id === me.person_id && me.roles.some((r) => r.role === 'eval_coordinator' && r.department_id === t.department_id);
  const approved = ['已核定', '免核定'].includes(t.approval_status);
  const closed = ['已結案', '已取消'].includes(t.status);
  const latest = ((updates ?? []) as Update[]).find((u) => u.kind === '進度回報');
  const pendingDecisions = ((decisions ?? []) as Decision[]).filter((d) => d.decision === '待核定' && d.kind !== '交辦核定' && d.kind !== '結案核定'
    && (d.kind === '期限變更' || me.is_director)); // 協調事項、提案只限主任處理

  // ── 流程狀態（只依資料庫欄位推導，不另建前端狀態）──
  const ds = (decisions ?? []) as Decision[];
  const collabIds = (collabs ?? []).map((c) => c.person_id);
  const isCreator = t.created_by === me.person_id;
  const baseRole = roleOf(t, me, collabIds);
  // 草案階段（未正式交辦）時，提報人身分比統籌、主管等身分更能說明「誰該修改重送」
  const role = !approved && isCreator && baseRole !== '主責' && baseRole !== '主任' ? '提報人' : baseRole ?? (isCreator ? '提報人' : null);
  const flow = deriveFlow(t, ds, role);
  const lastOf = (kind: string) => ds.filter((d) => d.kind === kind).sort((a, b) => b.id - a.id)[0];
  const lastApproval = lastOf('交辦核定');
  const lastClose = lastOf('結案核定');
  const pendingDue = ds.find((d) => d.kind === '期限變更' && d.decision === '待核定');
  const closeReturned = !closed && t.status !== '待主管核定' && lastClose?.decision === '退回';
  const draftReturned = t.approval_status === '退回' && !closed;
  const canResubmit = draftReturned && (isCreator || t.owner_person_id === me.person_id);
  const canClose = t.owner_person_id === me.person_id || canManage;
  const nameIds = [...new Set([lastClose?.requested_by, lastClose?.decided_by, lastApproval?.decided_by, t.closed_by, pendingDue?.requested_by].filter(Boolean) as string[])];
  const { data: named } = nameIds.length ? await sb.from('people').select('id,name').in('id', nameIds) : { data: [] as { id: string; name: string }[] };
  const nameOf = (pid: string | null | undefined) => (named ?? []).find((p) => p.id === pid)?.name ?? '—';
  const today = todayTaipei();
  const canReport = isMember || canManage;
  const reportMode = approved && !closed && canReport ? (t.status === '待主管核定' ? 'closePending' : 'active')
    : closed && canReport ? 'locked' : 'hidden';
  const lockReason = closed ? `這項工作已${t.status === '已結案' ? '核定結案' : '取消'}，不能再回報。`
    : !approved ? `這項工作目前不是正式交辦（${t.approval_status}），不能回報。`
    : '你目前不是這項工作的主責、協作人員或主管，不能回報。';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tasks" className="text-sm text-accent">← 工作管理</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="h1">{t.title}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge>{t.status}</Badge><Badge>{t.approval_status}</Badge>
          {t.is_overdue && !closed && approved && <Badge tone="逾期">{dueLabel(t.days_to_due, false)}</Badge>}
          {t.risk_category ? <Badge tone={t.risk_severity === '高' ? '逾期' : t.risk_severity === '中' ? '高' : undefined}>{`風險：${t.risk_category}・${t.risk_severity}`}</Badge> : <Badge>風險未評估</Badge>}
          {t.priority !== '中' && <Badge>{`優先度 ${t.priority}`}</Badge>}
          {t.sensitivity !== '一般內部' && <Badge>{t.sensitivity}</Badge>}
          {t.needs_handoff && <Badge tone="留職停薪">待交接</Badge>}
          <span className="text-muted">{t.id}</span>
        </div>
        {decided === 'approved' && <p role="status" className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">已核定交辦，已通知主責與協作人員。</p>}
        {decided === 'returned' && <p role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">已退回，已通知提報人。</p>}
        {created && <p role="status" className="mt-3 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">已建立。{approved ? '已正式交辦並通知主責人。' : '目前為「待主任核定」，核定前不會通知承辦人。'}</p>}

        {/* 流程橫幅：目前在哪一步、等誰、我下一步做什麼 */}
        <section aria-label="目前流程" data-flow={flow.label} className={`mt-4 rounded-lg border-l-4 p-4 ${FLOW_TONE[flow.tone]}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">目前流程：{flow.label}</span>
            {role && <span className="rounded-full border border-line bg-card px-2 py-0.5 text-xs">你的角色：{role}</span>}
            {flow.waitingFor && <span className="text-xs text-muted">等候：{flow.waitingFor}</span>}
          </div>
          <p className="mt-1 text-sm">→ {flow.nextStep}</p>

          {draftReturned && (
            <div className="mt-3 text-sm">
              <p><b className="text-danger">退回原因：</b>{decisionNote(lastApproval?.reason) || '（核定者未填寫原因）'}
                {lastApproval?.decided_at && <span className="ml-1 text-xs text-muted">（{nameOf(lastApproval.decided_by)}・{fmtDateTime(lastApproval.decided_at)}）</span>}</p>
              <p className="mt-1 text-xs text-muted">退回的提報不是正式交辦；修改後重新提報，仍需主任核定。</p>
            </div>
          )}
          {t.approval_status === '待主任核定' && !closed && (
            <p className="mt-2 text-sm">尚未正式交辦：核定前承辦人不需執行，也不會收到通知。
              {lastApproval?.parent_decision_id && <span className="ml-1 text-xs text-muted">（這是補件後的重新提報）</span>}</p>
          )}
          {t.status === '待主管核定' && lastClose?.decision === '待核定' && (
            <p className="mt-2 text-sm">送件時間：{fmtDateTime(lastClose.requested_at)}（{nameOf(lastClose.requested_by)}）・核定者：{flow.waitingFor}
              {lastClose.parent_decision_id && <span className="ml-1 text-xs text-muted">（補件後重新申請）</span>}</p>
          )}
          {closeReturned && (
            <div className="mt-3 text-sm">
              <p><b className="text-danger">結案退回原因：</b>{decisionNote(lastClose.reason) || '（核定者未填寫原因）'}
                {lastClose.decided_at && <span className="ml-1 text-xs text-muted">（{nameOf(lastClose.decided_by)}・{fmtDateTime(lastClose.decided_at)}）</span>}</p>
              {canClose && approved && <a href="#report" className="btn-primary mt-2 inline-flex min-h-11 items-center">補件後重新申請結案</a>}
            </div>
          )}
          {pendingDue && !closed && (
            <p className="mt-2 text-sm">期限變更申請：原期限 <b>{fmtDate(pendingDue.before_value?.due_on)}</b> → 申請改為 <b>{fmtDate(pendingDue.after_value?.due_on)}</b>
              （{nameOf(pendingDue.requested_by)}・{fmtDateTime(pendingDue.requested_at)}）。<b>核定前原期限仍有效。</b></p>
          )}
          {t.status === '已結案' && (
            <p className="mt-2 text-sm">核定結案：{fmtDate(t.closed_on)}（{nameOf(t.closed_by)}）
              {t.result_link && !t.evidence_restricted && <>・<a href={t.result_link} target="_blank" rel="noreferrer" className="text-accent underline">查看成果</a></>}
              {t.result_link && t.evidence_restricted && <>・成果屬受限索引，需另行授權調閱</>}</p>
          )}
        </section>
        {canResubmit && (
          <section className="card mt-3 p-4">
            <h2 className="h2 mb-2">修改後重新提報</h2>
            <ResubmitForm taskId={t.id} title={t.title} due={t.due_on} notes={t.notes} updatedAt={t.updated_at} today={today} />
          </section>
        )}
      </div>

      {!approved && !closed && !draftReturned && (
        <section className="card border-l-4 border-l-hold p-4">
          <h2 className="h2">草案：尚未正式交辦</h2>
          <p className="mt-1 text-sm text-muted">
            {t.source_sheet ? `此任務由 V5「${t.source_sheet}」第 ${t.source_row} 列匯入，原始狀態為「${t.source_status_raw}／${t.source_approval_raw}」，` : ''}
            需主任核定後才算正式交辦；核定前承辦人無法開始執行，也不會收到通知。期限欄位目前是「建議內部期限」。
          </p>
          {(isDirector || isLead) && (
            <ActionForm action={approveTask} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
              <input type="hidden" name="id" value={t.id} />
              <div>
                <label className="label" htmlFor="ap-owner">核定主責人</label>
                <select id="ap-owner" name="owner" defaultValue={t.owner_person_id ?? ''} className="field">
                  <option value="">— 請選擇 —</option>
                  {assignable.map((p) => <option key={p.id} value={p.id}>{p.name}｜{p.title}</option>)}
                </select>
                {t.owner_person_id && !assignable.some((p) => p.id === t.owner_person_id) && (
                  <p className="hint text-danger">原建議主責「{t.owner_name}」目前不是已確認在職的同仁，請先到「組織人員」確認在職或改派。</p>
                )}
              </div>
              <div><label className="label" htmlFor="ap-due">核定期限</label><input id="ap-due" name="due" type="date" defaultValue={t.due_on ?? ''} className="field" /></div>
              <div><label className="label" htmlFor="ap-note">核定意見</label><input id="ap-note" name="note" className="field" /></div>
              <div className="flex gap-2 md:col-span-3">
                <Submit name="decision" value="核定">核定交辦</Submit>
                <Submit name="decision" value="退回" variant="ghost">退回</Submit>
              </div>
            </ActionForm>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <h2 className="h2 mb-4">工作內容</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            <Field label="主責人">{t.owner_name ?? <span className="text-danger">未指派</span>}</Field>
            <Field label="協作">{t.collaborator_names}</Field>
            <Field label="評鑑統籌">{t.coordinator_name}</Field>
            <Field label="組別">{t.department_name}</Field>
            <Field label="期限">{fmtDate(t.due_on)}<span className="ml-1 text-xs text-muted">民國 {fmtDate(t.due_on, true)}</span></Field>
            <Field label="下次追蹤">{fmtDate(t.next_followup_on)}</Field>
            <Field label="最新下一步">{latest?.next_action ? <>{latest.next_action}{latest.next_action_due_on && <span className={`ml-1 text-xs ${t.due_on && latest.next_action_due_on > t.due_on ? 'font-semibold text-danger' : 'text-muted'}`}>（預計 {fmtDate(latest.next_action_due_on)}{t.due_on && latest.next_action_due_on > t.due_on ? '，晚於正式期限' : ''}）</span>}</> : null}</Field>
            <Field label="工作階段">{t.stage}</Field>
            <Field label="承辦回報完成">{fmtDate(t.completed_on)}</Field>
            <Field label="正式結案">{fmtDate(t.closed_on)}</Field>
          </dl>
          {t.deliverables && <div className="mt-4"><div className="text-xs text-muted">應備佐證／成果</div><p>{t.deliverables}</p></div>}
          {t.cross_support && <div className="mt-3"><div className="text-xs text-muted">跨組協作／專業支援</div><p>{t.cross_support}</p></div>}
          {t.notes && <div className="mt-3"><div className="text-xs text-muted">說明</div><p className="whitespace-pre-wrap">{t.notes}</p></div>}
          {t.evidence_restricted && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">成果文件屬「受限索引」：連結需另行授權才能調閱。</p>}
          {!!links?.length && (
            <div className="mt-4">
              <div className="text-xs text-muted">關聯評鑑指標</div>
              <ul className="mt-1 space-y-1">
                {links.map((l) => <li key={l.indicator_id}><Link href={`/evaluation/item?id=${encodeURIComponent(l.indicator_id)}`} className="text-accent hover:underline">{l.indicator_id} {indName.get(l.indicator_id)}</Link> <span className="text-xs text-muted">（{l.check_status}；任務結案≠指標符合）</span></li>)}
              </ul>
            </div>
          )}
        </section>

        <div className="space-y-4">
          {/* 回報區固定掛載：任務狀態或權限改變時，同仁尚未送出的內容不會隨頁面重新整理而消失 */}
          <ReportPanel taskId={t.id} status={t.status} role={role} today={today} updatedAt={t.updated_at}
                       initialTab={closeReturned ? '申請結案' : undefined} canClose={canClose}
                       mode={reportMode} lockReason={lockReason}
                       reworkReason={closeReturned ? decisionNote(lastClose.reason) || '（未填寫）' : undefined} />

          {t.status === '待主管核定' && (isDirector || isLead) && (
            <section className="card border-l-4 border-l-warn p-4">
              <h2 className="h2 mb-2">核定結案</h2>
              <p className="mb-3 text-sm text-muted">承辦人已回報完成。結案只代表工作完成，指標是否符合仍需另行檢核。</p>
              <ActionForm action={closeTask} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                {lastClose?.after_value && (
                  <dl className="space-y-1 rounded-lg bg-paper p-3 text-sm">
                    <Row label="交付成果">{lastClose.after_value.deliverables ?? '—'}</Row>
                    {lastClose.after_value.result_link && <Row label="成果連結">{lastClose.after_value.result_link}</Row>}
                    {lastClose.after_value.evidence_note && <Row label="佐證說明">{lastClose.after_value.evidence_note}</Row>}
                  </dl>
                )}
                <div><label className="label" htmlFor="cn">意見（退回時必填：原因與待補事項）</label><input id="cn" name="note" className="field" /></div>
                <div className="flex gap-2"><Submit name="decision" value="核定">核定結案</Submit><Submit name="decision" value="退回" variant="ghost">退回補正</Submit></div>
              </ActionForm>
            </section>
          )}

          <section className="card p-4">
            <h2 className="h2 mb-1">風險評估</h2>
            <p className="mb-2 text-sm">
              {t.risk_category ? <>目前：<b>{t.risk_category}</b>・嚴重程度 <b>{t.risk_severity}</b></> : <span className="text-muted">尚未評估</span>}
              <span className="ml-1 text-xs text-muted">（風險與任務狀態、優先度分開；逾期由期限自動計算）</span>
            </p>
            {canManage && (
              <ActionForm action={setRisk} resetOnSuccess className="space-y-2">
                <input type="hidden" name="id" value={t.id} />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label" htmlFor="rk-cat">風險分類</label>
                    <select id="rk-cat" name="category" defaultValue={t.risk_category ?? ''} className="field">
                      <option value="">未評估</option>{['服務安全', '法定期限', '服務持續性', '一般營運行政'].map((c) => <option key={c}>{c}</option>)}
                    </select></div>
                  <div><label className="label" htmlFor="rk-sev">嚴重程度</label>
                    <select id="rk-sev" name="severity" defaultValue={t.risk_severity ?? ''} className="field">
                      <option value="">未評估</option><option>高</option><option>中</option><option>低</option>
                    </select></div>
                </div>
                <div><label className="label" htmlFor="rk-reason">調整理由 <span className="text-danger">*</span></label><input id="rk-reason" name="reason" required minLength={2} className="field" /></div>
                <Submit variant="ghost">更新風險</Submit>
              </ActionForm>
            )}
            {!!riskLog?.length && (
              <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-muted">
                {(riskLog as RiskChange[]).map((r) => (
                  <li key={r.id}>{fmtDateTime(r.changed_at)}：{r.from_category ? `${r.from_category}・${r.from_severity}` : '未評估'} → {r.to_category ? `${r.to_category}・${r.to_severity}` : '未評估'}（{r.reason}）</li>
                ))}
              </ul>
            )}
          </section>

          {canManage && !closed && (
            <section className="card p-4">
              <h2 className="h2 mb-3">分派主責／協作</h2>
              <ActionForm action={assignTask} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <div>
                  <label className="label" htmlFor="as-owner">主責人</label>
                  <select id="as-owner" name="owner" required defaultValue={assignable.some((p) => p.id === t.owner_person_id) ? t.owner_person_id! : ''} className="field">
                    <option value="" disabled>— 請選擇在職同仁 —</option>
                    {assignable.map((p) => <option key={p.id} value={p.id}>{p.name}｜{p.title}</option>)}
                  </select>
                </div>
                <fieldset><legend className="label">協作</legend>
                  <div className="grid grid-cols-2 gap-1">
                    {assignable.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="collaborators" value={p.id} defaultChecked={(collabs ?? []).some((c) => c.person_id === p.id)} />{p.name}</label>
                    ))}
                  </div>
                </fieldset>
                <div><label className="label" htmlFor="as-reason">改派原因</label><input id="as-reason" name="reason" className="field" /></div>
                <Submit variant="ghost">儲存分派</Submit>
              </ActionForm>
            </section>
          )}

          {!closed && (
            <section className="card p-4">
              <h2 className="h2 mb-1">{canManage ? '變更期限' : '申請變更期限'}</h2>
              <p className="mb-3 text-xs text-muted">{canManage ? '保留原期限、原因與核定者。' : '送出後由主管核定，核定前期限不變。'}</p>
              {pendingDue && !canManage ? (
                <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">已有一筆待核定的申請（改為 {fmtDate(pendingDue.after_value?.due_on)}），請等候主管處理；核定前原期限 {fmtDate(t.due_on)} 仍有效。</p>
              ) : (
              <ActionForm action={changeDue} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="nd">新期限</label><input id="nd" name="due" type="date" required className="field" /></div>
                  <div><label className="label" htmlFor="ndr">原因 <span className="text-danger">*</span></label><input id="ndr" name="reason" required className="field" /></div>
                </div>
                <Submit variant="ghost">送出</Submit>
              </ActionForm>
              )}
            </section>
          )}

          {isCoord && !closed && (
            <section className="card p-4">
              <h2 className="h2 mb-1">評鑑統籌</h2>
              <p className="mb-3 text-xs text-muted">你可以催辦與向主任提報；核定、改派與人事異動仍由主任決定。</p>
              {approved && (
                <ActionForm action={nudgeTask} resetOnSuccess className="mb-3 flex gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <label htmlFor="nm" className="sr-only">催辦訊息</label>
                  <input id="nm" name="message" required placeholder="提醒內容" className="field" />
                  <Submit variant="ghost">催辦</Submit>
                </ActionForm>
              )}
              <ActionForm action={proposeToDirector} resetOnSuccess className="flex gap-2">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor="pr" className="sr-only">提報內容</label>
                <input id="pr" name="reason" required placeholder="向主任提報（例：資料缺口、建議調整）" className="field" />
                <Submit variant="ghost">提報</Submit>
              </ActionForm>
            </section>
          )}

          {pendingDecisions.length > 0 && canManage && (
            <section className="card p-4">
              <h2 className="h2 mb-2">待處理申請</h2>
              {pendingDecisions.map((d) => (
                <ActionForm key={d.id} action={resolveDecision} className="mb-3 rounded-lg border border-line p-3 text-sm">
                  <input type="hidden" name="decision_id" value={d.id} /><input type="hidden" name="task_id" value={t.id} />
                  <div><b>{d.kind}</b>：{d.reason}</div>
                  {d.kind === '期限變更' && <div className="text-muted">{d.before_value?.due_on ?? '—'} → {d.after_value?.due_on}</div>}
                  <div className="mt-2 flex gap-2"><Submit name="result" value="核定">核定</Submit><Submit name="result" value="退回" variant="ghost">退回</Submit></div>
                </ActionForm>
              ))}
            </section>
          )}

          {canManage && !closed && (
            <details className="card p-4">
              <summary className="cursor-pointer text-sm text-danger">取消此工作</summary>
              <ActionForm action={cancelTask} confirm="確定要取消此工作嗎？" className="mt-3 space-y-2">
                <input type="hidden" name="id" value={t.id} />
                <label className="label" htmlFor="cr">取消原因</label><input id="cr" name="reason" required className="field" />
                <Submit variant="danger">確認取消</Submit>
              </ActionForm>
            </details>
          )}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="h2 mb-3">進度與核定歷程</h2>
        <ol className="space-y-3">
          {[
            ...((updates ?? []) as Update[]).map((u) => ({ at: u.created_at, key: `u${u.id}`, node: u.kind === '進度回報' ? (
              <div className="mt-1 rounded-lg border border-line bg-paper/50 p-3">
                <div className="text-sm"><b>{u.author_name ?? '系統'}</b> {u.report_type === '需要協助' ? '提出協助需求' : u.report_type === '申請結案' ? '申請結案' : '回報進度'}{u.status_to && <> ・狀態改為 <Badge>{u.status_to}</Badge></>}</div>
                <dl className="mt-2 space-y-1 text-sm">
                  <Row label={u.report_type === '申請結案' ? '交付成果' : u.report_type === '需要協助' ? '說明' : '本次成果'}>{u.done_items}</Row>
                  {u.difficulties && <Row label="卡點" danger>{u.difficulties}</Row>}
                  {u.next_action && <Row label="下一步">{u.next_action}{u.next_action_due_on && <span className="ml-1 text-muted">（預計 {fmtDate(u.next_action_due_on)}）</span>}</Row>}
                  {u.support_request && <Row label={`需要${u.support_type}`}>{u.support_request}</Row>}
                  {u.next_followup_on && <Row label="下次追蹤">{fmtDate(u.next_followup_on)}</Row>}
                  {u.support_needed_by && <Row label="希望回覆">{fmtDate(u.support_needed_by)}</Row>}
                  {u.report_type === '申請結案' && u.body && <Row label="佐證">{u.body}</Row>}
                  {u.acceptance_confirmed && <Row label="驗收確認">已確認依驗收條件完成</Row>}
                </dl>
              </div>
            ) : (
              <>
                <div className="text-sm"><b>{u.author_name ?? '系統'}</b>{u.status_to && <> 將狀態改為 <Badge>{u.status_to}</Badge></>}</div>
                {u.body && <p className="whitespace-pre-wrap text-sm">{u.body}</p>}
                {u.done_items && <p className="text-sm"><span className="text-muted">已完成：</span>{u.done_items}</p>}
                {u.difficulties && <p className="text-sm"><span className="text-muted">困難：</span>{u.difficulties}</p>}
                {u.next_action && <p className="text-sm"><span className="text-muted">下一步：</span>{u.next_action}{u.next_followup_on && `（追蹤 ${fmtDate(u.next_followup_on)}）`}</p>}
              </>
            ) })),
            ...((decisions ?? []) as Decision[]).map((d) => ({ at: d.decided_at ?? d.requested_at, key: `d${d.id}`, node: (
              <div className="text-sm"><Badge tone={d.decision === '核定' ? '已核定' : d.decision === '退回' ? '退回' : '待主任核定'}>{d.kind}・{d.decision}</Badge>
                {d.reason && <span className="ml-2">{d.reason}</span>}
                {d.kind === '期限變更' && <span className="ml-2 text-muted">{d.before_value?.due_on ?? '—'} → {d.after_value?.due_on}</span>}</div>
            ) })),
          ].sort((a, b) => b.at.localeCompare(a.at)).map((e) => (
            <li key={e.key} className="border-l-2 border-line pl-3">
              <div className="text-xs text-muted">{fmtDateTime(e.at)}</div>{e.node}
            </li>
          ))}
          {!updates?.length && !decisions?.length && <li className="text-sm text-muted">尚無紀錄。</li>}
        </ol>
      </section>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={TaskDetail as PageLoader} title="工作詳情" />;
}
