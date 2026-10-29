'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { fmtDate, fmtDateTime, todayTaipei } from '@/lib/format';
import {
  decideAssignment, markTextReviewed, proposeRevision, recordCheck, recordOfficialResult, reviewCheck,
  setApplicability, updateYearReview,
} from '../actions';

type Crit = {
  id: string; indicator_id: string; seq_label: string | null; text: string; kind: string; is_official: boolean;
  source_page: number | null; extraction_note: string | null; text_review_status: string; text_reviewed_by_name: string | null;
  text_reviewed_on: string | null; text_version: number; check_id: number | null; evidence_status: string | null;
  conformity: string | null; gap: string | null; evidence_ref: string | null; checked_by_name: string | null; checked_at: string | null;
  check_review_status: string | null; check_reviewed_by_name: string | null; review_note: string | null; check_count: number;
  has_pending_revision: boolean;
};

const EVIDENCE = ['未盤點', '部分齊備', '齊備'];
const CONFORMITY = ['待檢核', '符合', '部分符合', '不符合', '待確認不適用'];
// 適用性：從目前狀態可以改成哪些（與資料庫規則一致；資料庫仍會再檢查）
const NEXT_APPLICABILITY: Record<string, string[]> = {
  待確認: ['確認適評', '已申請不適評'],
  確認適評: ['待確認'],
  已申請不適評: ['核准不適評', '確認適評', '待確認'],
  核准不適評: ['待確認'],
};

function Stat({ label, value, of, tone }: { label: string; value: number | string; of?: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone ?? ''}`}>{value}{of !== undefined && <span className="text-sm font-normal text-muted"> / {of}</span>}</div>
    </div>
  );
}

function CriterionCard({ c, canEdit, isDirector, indicator }: { c: Crit; canEdit: boolean; isDirector: boolean; indicator: string }) {
  return (
    <li id={c.id} className="scroll-mt-20 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <b>{c.seq_label}</b>
        <Badge tone={c.text_review_status}>{c.text_review_status === '已複核' ? '原文已複核' : '原文未複核'}</Badge>
        {c.text_version > 1 && <span className="text-xs text-muted">第 {c.text_version} 版</span>}
        {c.has_pending_revision && <Badge tone="待主任核定">有修訂建議待核定</Badge>}
        <span className="text-xs text-muted">附件5 第 {c.source_page} 頁</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{c.text}</p>

      <div className="mt-3 grid gap-2 rounded-lg bg-paper p-3 text-sm sm:grid-cols-[auto_auto_1fr]">
        <div><span className="text-xs text-muted">佐證　</span>{c.evidence_status ? <Badge>{c.evidence_status}</Badge> : <Badge tone="未盤點">尚未檢核</Badge>}</div>
        <div><span className="text-xs text-muted">標準　</span>{c.conformity ? <Badge>{c.conformity}</Badge> : <span className="text-muted">—</span>}</div>
        <div className="text-xs text-muted sm:text-right">
          {c.checked_at ? <>{c.checked_by_name} 於 {fmtDateTime(c.checked_at)} 記錄・<Badge>{c.check_review_status!}</Badge>{c.check_reviewed_by_name && `（${c.check_reviewed_by_name}）`}</> : '尚無檢核紀錄'}
          {c.check_count > 1 && `・共 ${c.check_count} 筆歷程`}
        </div>
        {c.gap && <div className="sm:col-span-3"><span className="text-xs text-muted">缺口／待補：</span>{c.gap}</div>}
        {c.evidence_ref && <div className="sm:col-span-3"><span className="text-xs text-muted">佐證位置：</span>{c.evidence_ref}</div>}
        {c.review_note && <div className="sm:col-span-3"><span className="text-xs text-muted">複核意見：</span>{c.review_note}</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && (
          <details className="w-full rounded-lg border border-line p-3 text-sm">
            <summary className="cursor-pointer font-medium text-accent">記錄檢核</summary>
            <ActionForm action={recordCheck} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="criterion" value={c.id} /><input type="hidden" name="indicator" value={indicator} />
              <div><label className="label" htmlFor={`ev-${c.id}`}>佐證狀態</label>
                <select id={`ev-${c.id}`} name="evidence_status" className="field" defaultValue={c.evidence_status ?? '未盤點'}>{EVIDENCE.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label" htmlFor={`cf-${c.id}`}>標準符合（自評）</label>
                <select id={`cf-${c.id}`} name="conformity" className="field" defaultValue={c.conformity ?? '待檢核'}>{CONFORMITY.map((x) => <option key={x}>{x}</option>)}</select>
                <p className="hint">「佐證齊備」不等於「符合」；請逐項對照標準判斷。</p></div>
              <div className="sm:col-span-2"><label className="label" htmlFor={`gap-${c.id}`}>缺口／待補事項（部分符合或不符合必填）</label>
                <textarea id={`gap-${c.id}`} name="gap" rows={2} className="field" placeholder="勿寫服務對象姓名、病歷等個資" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor={`ref-${c.id}`}>佐證存放位置／文件編號</label>
                <input id={`ref-${c.id}`} name="evidence_ref" className="field" placeholder="例：行政組共用資料夾／115 消防檢修申報" /></div>
              <div className="sm:col-span-2"><Submit>送出檢核</Submit></div>
            </ActionForm>
          </details>
        )}
        {isDirector && c.check_id && c.check_review_status === '待複核' && (
          <ActionForm action={reviewCheck} className="flex w-full flex-wrap items-end gap-2">
            <input type="hidden" name="check" value={c.check_id} /><input type="hidden" name="indicator" value={indicator} />
            <div className="grow"><label className="label" htmlFor={`rv-${c.id}`}>複核意見（退回必填）</label><input id={`rv-${c.id}`} name="note" className="field" /></div>
            <Submit name="result" value="已複核">複核通過</Submit><Submit name="result" value="退回" variant="ghost">退回</Submit>
          </ActionForm>
        )}
        {isDirector && c.text_review_status !== '已複核' && (
          <ActionForm action={markTextReviewed} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="criterion" value={c.id} /><input type="hidden" name="indicator" value={indicator} />
            <input type="hidden" name="note" value={`已對照附件5 第 ${c.source_page} 頁`} />
            <Submit variant="ghost">原文已對照 PDF，無誤</Submit>
          </ActionForm>
        )}
        {!c.has_pending_revision && (
          <details className="w-full text-sm">
            <summary className="cursor-pointer text-muted">原文與 PDF 不符？提出修訂建議</summary>
            <ActionForm action={proposeRevision} className="mt-2 space-y-2" resetOnSuccess>
              <input type="hidden" name="criterion" value={c.id} /><input type="hidden" name="indicator" value={indicator} />
              <div><label className="label" htmlFor={`tx-${c.id}`}>建議文字（完整一條）</label><textarea id={`tx-${c.id}`} name="text" rows={3} className="field" defaultValue={c.text} /></div>
              <div><label className="label" htmlFor={`rs-${c.id}`}>依據</label><input id={`rs-${c.id}`} name="reason" className="field" placeholder={`例：附件5 第 ${c.source_page} 頁原文為…`} /></div>
              <Submit variant="ghost">送主任核定</Submit>
              <p className="hint">送出後原文不會變動，需主任在決策佇列核定。</p>
            </ActionForm>
          </details>
        )}
      </div>
    </li>
  );
}

async function IndicatorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, sb } = await requireMe();
  const [{ data: i }, { data: ind }] = await Promise.all([
    sb.from('v_indicators').select('*').eq('id', id).maybeSingle(),
    sb.from('evaluation_indicators').select('official_method,official_period_text,pdf_pages,applicability_basis,applicability_decided_at').eq('id', id).maybeSingle(),
  ]);
  if (!i || !ind) notFound();
  const [{ data: crits }, { data: q }, { data: canEditRaw }, { data: reviews }, { data: tasks }, { data: appHist }, { data: findings }, { data: results }] = await Promise.all([
    sb.from('v_criteria').select('*').eq('indicator_id', id).order('id'),
    sb.from('v_indicator_quality').select('*').eq('id', id).maybeSingle(),
    sb.rpc('can_edit_indicator', { p_indicator: id }),
    sb.from('evidence_year_reviews').select('*').eq('indicator_id', id).order('year_label'),
    sb.from('v_tasks').select('id,title,owner_name,status,approval_status,due_on').contains('indicator_ids', [id]).order('id'),
    sb.from('indicator_applicability_history').select('*').eq('indicator_id', id).order('decided_at', { ascending: false }),
    sb.from('v_findings').select('id,summary,status,found_on,open_action_count').eq('indicator_id', id).order('found_on', { ascending: false }),
    sb.from('indicator_official_results').select('*').eq('indicator_id', id).order('recorded_at', { ascending: false }),
  ]);
  const { data: evidence } = await sb.from('v_evidence').select('id,title,year_label,storage_kind,sensitivity,status')
    .contains('indicator_ids', [id]).order('year_label').order('created_at');
  const canEdit = canEditRaw === true;
  const all = (crits ?? []) as Crit[];
  const sortKey = (c: Crit) => Number(c.id.match(/-[SN](\d+)$/)?.[1] ?? 0);
  const official = all.filter((c) => c.kind === '官方標準原文').sort((a, b) => sortKey(a) - sortKey(b));
  const notes = all.filter((c) => c.kind === '官方註記').sort((a, b) => sortKey(a) - sortKey(b));
  const summary = all.filter((c) => c.kind === '管理檢核摘要');
  const app = (i.applicability_raw ?? {}) as Record<string, string>;
  const pages = (ind.pdf_pages as number[] | null) ?? [i.pdf_page];
  const nextApp = NEXT_APPLICABILITY[i.applicability_status] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/evaluation" className="text-sm text-accent">← 評鑑中心</Link>
        <h1 className="h1 mt-1">{i.id} {i.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge>{i.dimension_name}</Badge><Badge>{`配分 ${i.total_points}`}</Badge>{i.is_core && <Badge tone="緊急">核心指標（未滿分等第降一等）</Badge>}
          <Badge tone={i.applicability_status}>{`適用性：${i.applicability_status}`}</Badge>
          <span className="text-muted">附件5 PDF 第 {pages.join('、')} 頁</span>
        </div>
      </div>

      {/* 三種狀態分開呈現：佐證齊備、標準符合（自評）、委員評定（正式結果） */}
      <section className="card p-5" aria-labelledby="qhead">
        <h2 id="qhead" className="h2 mb-1">品質追蹤摘要</h2>
        <p className="mb-3 text-sm text-muted">「佐證齊備」「自評符合」「委員評定」三者分開，系統<b>不</b>由自評推算分數。</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="原文已人工複核" value={q?.text_reviewed_count ?? 0} of={q?.official_count ?? 0} />
          <Stat label="已檢核標準" value={q?.checked_count ?? 0} of={q?.official_count ?? 0} />
          <Stat label="佐證齊備" value={q?.evidence_ready_count ?? 0} of={q?.official_count ?? 0} />
          <Stat label="自評符合" value={q?.conform_count ?? 0} of={q?.official_count ?? 0} />
          <Stat label="有缺口" value={q?.gap_count ?? 0} tone={q?.gap_count ? 'text-danger' : ''} />
          <Stat label="委員評定（正式）" value={q?.official_result ?? '尚未公布'} />
        </div>
        {!canEdit && !me.is_director && (
          <p className="mt-3 text-sm text-muted">你可以檢視與提出修訂建議。記錄檢核需由主任或「已核定分工」的指標主責操作{i.assignment_approval_status !== '已核定' && '（本指標分工目前仍待主任核定）'}。</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="ohead">
        <h2 id="ohead" className="h2 mb-1">官方標準原文（附件5）</h2>
        <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          原文由系統自 PDF 擷取，已修正 16 個字型對應錯誤字元；標示「原文未複核」者請對照 PDF 第 {pages.join('、')} 頁確認。內容以 PDF 為準。
        </p>
        <ol className="space-y-3">{official.map((c) => <CriterionCard key={c.id} c={c} canEdit={canEdit} isDirector={me.is_director} indicator={id} />)}</ol>
        {notes.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">官方註記</h3>
            <ul className="space-y-2 text-sm">{notes.map((n) => (
              <li key={n.id} id={n.id} className="rounded-lg border border-line p-3"><b>{n.seq_label}</b>　{n.text}</li>
            ))}</ul>
          </div>
        )}
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-xs text-muted">評鑑實施方式（原文）</dt><dd className="whitespace-pre-wrap">{ind.official_method ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">資料應準備期間</dt><dd>{ind.official_period_text ?? `${fmtDate(i.evidence_from)} ～ ${fmtDate(i.evidence_to)}`}</dd></div>
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5" aria-labelledby="ahead">
          <h2 id="ahead" className="h2 mb-3">適用性確認</h2>
          <div className="text-xs text-muted">五類機構適用性（官方表格原始標示）</div>
          <div className="mt-1 flex flex-wrap gap-2">{Object.entries(app).map(([k, v]) => <span key={k} className={`rounded-md border px-2 py-0.5 text-sm ${k === '日間生活照顧' ? 'border-accent' : 'border-line'}`}>{k}：<b>{v}</b></span>)}</div>
          <p className="mt-3 text-sm">目前：<Badge tone={i.applicability_status}>{i.applicability_status}</Badge>{ind.applicability_basis && <span className="text-muted">　依據 {ind.applicability_basis}</span>}</p>
          {i.applicability_note && <p className="mt-1 text-sm"><span className="text-muted">V5 適用性初判：</span>{i.applicability_note}</p>}
          <p className="mt-2 text-xs text-muted">官方 V/X 只是初步資訊。不適評須依評鑑程序向主管機關申請並經核准，系統不自行認定。</p>
          {me.is_director && nextApp.length > 0 && (
            <ActionForm action={setApplicability} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="indicator" value={id} />
              <div><label className="label" htmlFor="ap-s">改為</label><select id="ap-s" name="status" className="field">{nextApp.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className="label" htmlFor="ap-d">依據日期</label><input id="ap-d" type="date" name="basis_date" max={todayTaipei()} className="field" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="ap-b">依據文號（申請／核准不適評必填）</label><input id="ap-b" name="basis" className="field" placeholder="例：北市社身字第 1150000000 號" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="ap-n">說明（改回待確認必填）</label><input id="ap-n" name="note" className="field" /></div>
              <div className="sm:col-span-2"><Submit>確認變更</Submit></div>
            </ActionForm>
          )}
          {(appHist ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">{appHist!.map((h) => (
              <li key={h.id}>{fmtDateTime(h.decided_at)}：{h.from_status} → <b className="text-ink">{h.to_status}</b>{h.basis && `（${h.basis}${h.basis_date ? `，${fmtDate(h.basis_date)}` : ''}）`}{h.note && `｜${h.note}`}</li>
            ))}</ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="shead">
          <h2 id="shead" className="h2 mb-3">分工（V5 草案）</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted">主責</dt><dd>{i.owner_name ?? '—'}（{i.owner_department_id ?? '—'}）</dd></div>
            <div><dt className="text-xs text-muted">協作</dt><dd>{i.collaborators_text ?? '—'}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">核定狀態</dt><dd><Badge>{i.assignment_approval_status}</Badge> <span className="text-muted">原文：{i.assignment_approval_raw}</span></dd></div>
          </dl>
          {i.core_evidence_note && <p className="mt-3 text-sm"><span className="text-muted">核心佐證與工作拆解：</span>{i.core_evidence_note}</p>}
          <p className="mt-2 text-xs text-muted">分工核定後，主責才能記錄檢核與更新年度盤點。</p>
          {me.is_director && i.assignment_approval_status !== '已核定' && (
            <ActionForm action={decideAssignment} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="indicator" value={i.id} />
              <div className="grow"><label className="label" htmlFor="an">意見</label><input id="an" name="note" className="field" /></div>
              <Submit name="decision" value="已核定">核定分工</Submit><Submit name="decision" value="退回" variant="ghost">退回</Submit>
            </ActionForm>
          )}
        </section>
      </div>

      <section className="card overflow-x-auto" aria-labelledby="yhead">
        <h2 id="yhead" className="h2 border-b border-line px-4 py-3">年度佐證盤點</h2>
        <table className="w-full">
          <thead className="bg-paper"><tr><th className="th">年度</th><th className="th">應備資料</th><th className="th">資料存在</th><th className="th">完整</th><th className="th">可供核對</th><th className="th">補正方式</th><th className="th">更新</th></tr></thead>
          <tbody className="divide-y divide-line">{(reviews ?? []).map((r) => (
            <tr key={r.id}>
              <td className="td whitespace-nowrap">{r.year_label}</td>
              <td className="td text-sm">{r.required_evidence ?? '—'}</td>
              <td className="td">{r.exists_status}</td><td className="td">{r.complete_status}</td><td className="td">{r.verifiable_status}</td>
              <td className="td text-sm">{r.improvement_note ?? '—'}</td>
              <td className="td text-sm">
                {r.reviewed_on && <div className="text-xs text-muted">{fmtDate(r.reviewed_on)}</div>}
                {canEdit && (
                  <details><summary className="cursor-pointer text-accent">更新</summary>
                    <ActionForm action={updateYearReview} className="mt-2 w-64 space-y-2">
                      <input type="hidden" name="review" value={r.id} /><input type="hidden" name="indicator" value={id} />
                      <div><label className="label" htmlFor={`ye-${r.id}`}>資料存在</label><select id={`ye-${r.id}`} name="exists" defaultValue={r.exists_status} className="field">{['待盤點', '有', '部分', '無'].map((x) => <option key={x}>{x}</option>)}</select></div>
                      <div><label className="label" htmlFor={`yc-${r.id}`}>完整</label><select id={`yc-${r.id}`} name="complete" defaultValue={r.complete_status} className="field">{['待盤點', '是', '部分', '否'].map((x) => <option key={x}>{x}</option>)}</select></div>
                      <div><label className="label" htmlFor={`yv-${r.id}`}>可供核對</label><select id={`yv-${r.id}`} name="verifiable" defaultValue={r.verifiable_status} className="field">{['待盤點', '是', '部分', '否'].map((x) => <option key={x}>{x}</option>)}</select></div>
                      <div><label className="label" htmlFor={`yi-${r.id}`}>補正方式（有缺漏必填）</label><input id={`yi-${r.id}`} name="improvement" defaultValue={r.improvement_note ?? ''} className="field" /></div>
                      <Submit>儲存</Submit>
                    </ActionForm>
                  </details>
                )}
              </td>
            </tr>
          ))}{!reviews?.length && <tr><td className="td text-muted" colSpan={7}>無年度盤點資料</td></tr>}</tbody>
        </table>
      </section>

      <section className="card overflow-x-auto" aria-labelledby="ehead">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="ehead" className="h2">佐證文件（你有權限看到的）</h2>
          <Link href={`/evidence/new?indicator=${id}`} className="btn-ghost text-sm">登錄佐證</Link>
        </div>
        <ul className="divide-y divide-line">{(evidence ?? []).map((d) => (
          <li key={d.id} className="px-4 py-2.5"><Link href={`/evidence/item?id=${encodeURIComponent(d.id)}`} className="hover:underline">{d.title}</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {d.year_label && <span>{d.year_label} 年度・</span>}<span>{d.storage_kind}</span><Badge>{d.sensitivity}</Badge><Badge>{d.status}</Badge>
            </div></li>
        ))}{!evidence?.length && <li className="px-4 py-4 text-sm text-muted">尚未登錄佐證。關聯佐證不會自動判定標準符合，仍需逐條檢核。</li>}</ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-x-auto" aria-labelledby="fhead">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 id="fhead" className="h2">缺失與改善</h2>
            <Link href={`/improvements/new?indicator=${id}`} className="btn-ghost text-sm">提報缺失</Link>
          </div>
          <ul className="divide-y divide-line">{(findings ?? []).map((f) => (
            <li key={f.id} className="px-4 py-2.5"><Link href={`/improvements/item?id=${encodeURIComponent(f.id)}`} className="hover:underline">{f.summary}</Link>
              <div className="text-xs text-muted">{fmtDate(f.found_on)}・<Badge>{f.status}</Badge>{f.open_action_count > 0 && `・未完成措施 ${f.open_action_count}`}</div></li>
          ))}{!findings?.length && <li className="px-4 py-4 text-sm text-muted">沒有你可檢視的缺失紀錄</li>}</ul>
        </section>
        <section className="card overflow-x-auto" aria-labelledby="thead">
          <h2 id="thead" className="h2 border-b border-line px-4 py-3">關聯工作（你有權限看到的）</h2>
          <ul className="divide-y divide-line">{(tasks ?? []).map((t) => (
            <li key={t.id} className="px-4 py-2.5"><Link href={`/tasks/item?id=${encodeURIComponent(t.id)}`} className="hover:underline">{t.title}</Link><div className="text-xs text-muted">{t.owner_name}・<Badge>{t.status}</Badge> <Badge>{t.approval_status}</Badge>・{fmtDate(t.due_on)}</div></li>
          ))}{!tasks?.length && <li className="px-4 py-4 text-sm text-muted">無</li>}</ul>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="rhead">
        <h2 id="rhead" className="h2 mb-1">委員評定結果（正式）</h2>
        <p className="mb-3 text-sm text-muted">只在收到正式評鑑結果公文後，由主任依公文原文登錄。自評與佐證狀態不會轉成這裡的結果。</p>
        {(results ?? []).length > 0
          ? <ul className="space-y-1 text-sm">{results!.map((r) => <li key={r.id}><b>{r.result_text}</b>　<span className="text-muted">{r.source_doc}（{fmtDate(r.source_date)}）登錄於 {fmtDateTime(r.recorded_at)}</span>{r.note && `｜${r.note}`}</li>)}</ul>
          : <p className="text-sm">尚未公布</p>}
        {me.is_director && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-accent">登錄正式結果</summary>
            <ActionForm action={recordOfficialResult} className="mt-2 grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="indicator" value={id} />
              <div><label className="label" htmlFor="or-r">結果（依公文原文）</label><input id="or-r" name="result" className="field" /></div>
              <div><label className="label" htmlFor="or-d">公文字號</label><input id="or-d" name="source_doc" className="field" /></div>
              <div><label className="label" htmlFor="or-t">公文日期</label><input id="or-t" type="date" name="source_date" max={todayTaipei()} className="field" /></div>
              <div className="sm:col-span-3"><Submit variant="ghost">登錄</Submit></div>
            </ActionForm>
          </details>
        )}
      </section>

      <section className="card p-5" aria-labelledby="mhead">
        <h2 id="mhead" className="h2 mb-1">管理檢核摘要（V5 09 表）</h2>
        <p className="mb-3 text-sm text-muted">內部整理的摘要，<b>不是官方評分條文</b>；正式檢核請以上方官方原文逐條進行。</p>
        <ul className="space-y-2">{summary.map((c) => (
          <li key={c.id} className="rounded-lg border border-line p-3 text-sm"><div className="flex flex-wrap gap-2"><b>{c.id}</b><Badge>{c.kind}</Badge></div><p className="mt-1">{c.text}</p></li>
        ))}{!summary.length && <li className="text-sm text-muted">無</li>}</ul>
      </section>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={IndicatorDetail as PageLoader} title="指標詳情" />;
}
