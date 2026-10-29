'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';

type Ind = { id: string; official_seq: number; name: string; dimension_id: number; dimension_name: string; total_points: number; is_core: boolean; day_care_vx: string; applicability_status: string; eval_status: string; owner_name: string | null; owner_department_id: string | null; assignment_approval_status: string | null; assignment_approval_raw: string | null; linked_task_count: number; closed_task_count: number; year_review_count: number; year_review_pending: number; official_criteria_count: number; summary_criteria_count: number };

async function Evaluation({ searchParams }: { searchParams: Promise<{ status?: string; applicability?: string; assignment?: string; edu?: string; vx?: string }> }) {
  const sp = await searchParams;
  const { sb } = await requireMe();
  let q = sb.from('v_indicators').select('*').order('official_seq').order('id');
  if (sp.status) q = q.eq('eval_status', sp.status);
  if (sp.applicability) q = q.eq('applicability_status', sp.applicability);
  if (sp.assignment) q = q.eq('assignment_approval_status', sp.assignment);
  if (sp.edu) q = q.gt('linked_task_count', 0);
  if (sp.vx) q = q.eq('day_care_vx', sp.vx);
  const [{ data }, { data: qual }] = await Promise.all([q, sb.from('v_indicator_quality').select('*')]);
  const rows = (data ?? []) as Ind[];
  type Q = { id: string; official_count: number; text_reviewed_count: number; checked_count: number; evidence_ready_count: number; conform_count: number; gap_count: number; open_findings: number };
  const qm = new Map(((qual ?? []) as Q[]).map((x) => [x.id, x]));
  const sum = (k: keyof Q) => ((qual ?? []) as Q[]).reduce((a, x) => a + Number(x[k] ?? 0), 0);
  const dims = [...new Map(rows.map((r) => [r.dimension_id, r.dimension_name])).entries()];
  const chip = (label: string, href: string, on: boolean) => (
    <Link href={href} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>{label}</Link>
  );
  return (
    <div className="space-y-5">
      <header>
        <h1 className="h1">第12次評鑑中心</h1>
        <p className="text-sm text-muted">
          官方 PDF（附件5）為準：58 筆指標分項。「日間生活照顧 V/X」是官方表格原始標示，本中心適評結果仍「待確認」，需依立案類別與主管機關程序認定。
          此處顯示內部盤點進度，<b>不是評鑑分數</b>。
        </p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="篩選">
        {chip('全部', '/evaluation', !Object.keys(sp).length)}
        {chip('有教保任務', '/evaluation?edu=1', !!sp.edu)}
        {chip('尚未盤點', '/evaluation?status=尚未盤點', sp.status === '尚未盤點')}
        {chip('待確認不適評', '/evaluation?status=待確認不適評', sp.status === '待確認不適評')}
        {chip('日間照顧標示 X', '/evaluation?vx=X', sp.vx === 'X')}
        {chip('分工待主任核定', '/evaluation?assignment=待主任核定', sp.assignment === '待主任核定')}
      </nav>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="全中心逐條檢核進度">
        {([['官方標準', sum('official_count'), ''], ['原文已人工複核', sum('text_reviewed_count'), ''], ['已逐條檢核', sum('checked_count'), ''],
           ['佐證齊備', sum('evidence_ready_count'), ''], ['自評符合', sum('conform_count'), ''], ['有缺口', sum('gap_count'), 'text-danger']] as const).map(([l, v, t]) => (
          <div key={l} className="card px-3 py-2"><div className="text-xs text-muted">{l}</div><div className={`text-xl font-semibold tabular-nums ${v && t ? t : ''}`}>{v}</div></div>
        ))}
      </section>
      <p className="text-sm text-muted">共 {rows.length} 筆。「佐證齊備」「自評符合」為內部檢核，不是評鑑分數。</p>
      {dims.map(([dimId, dimName]) => (
        <section key={dimId} className="card overflow-x-auto">
          <h2 className="h2 border-b border-line px-4 py-3">{dimName}</h2>
          <table className="w-full">
            <thead className="bg-paper"><tr><th className="th">指標</th><th className="th">配分</th><th className="th">日照 V/X</th><th className="th">適用性</th><th className="th">盤點狀態</th><th className="th">主責（草案）</th><th className="th">分工核定</th><th className="th text-right">教保任務</th><th className="th text-right">年度盤點</th><th className="th text-right" title="已檢核／官方標準條數；齊備、符合、缺口分開計算">逐條檢核</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.filter((r) => r.dimension_id === dimId).map((r) => (
                <tr key={r.id}>
                  <td className="td"><Link href={`/evaluation/item?id=${encodeURIComponent(r.id)}`} className="font-medium hover:underline">{r.id} {r.name}</Link>{r.is_core && <> <Badge tone="緊急">核心指標</Badge></>}</td>
                  <td className="td tabular-nums">{r.total_points}</td>
                  <td className="td"><Badge tone={r.day_care_vx === 'X' ? '待確認' : undefined}>{r.day_care_vx}</Badge></td>
                  <td className="td"><Badge tone={r.applicability_status}>{r.applicability_status}</Badge></td>
                  <td className="td whitespace-nowrap">{r.eval_status}</td>
                  <td className="td whitespace-nowrap">{r.owner_name ?? '—'}</td>
                  <td className="td"><Badge>{r.assignment_approval_status ?? '—'}</Badge></td>
                  <td className="td text-right tabular-nums">{r.linked_task_count ? <Link className="text-accent" href={`/tasks?indicator=${r.id}`}>{r.closed_task_count}/{r.linked_task_count}</Link> : '—'}</td>
                  <td className="td text-right tabular-nums">{r.year_review_count ? `${r.year_review_count - r.year_review_pending}/${r.year_review_count}` : '—'}</td>
                  <td className="td text-right tabular-nums whitespace-nowrap">{(() => { const x = qm.get(r.id); if (!x) return '—'; return (<>
                    <span>{x.checked_count}/{x.official_count}</span>
                    <div className="text-xs text-muted">齊備 {x.evidence_ready_count}・符合 {x.conform_count}{x.gap_count ? <span className="text-danger">・缺口 {x.gap_count}</span> : null}</div></>); })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Evaluation as PageLoader} title="評鑑中心" />;
}
