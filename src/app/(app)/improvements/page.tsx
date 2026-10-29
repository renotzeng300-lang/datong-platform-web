'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { fmtDate } from '@/lib/format';

const STATUSES = ['待改善', '改善中', '待複核', '已結案'] as const;

type F = { id: string; source: string; summary: string; status: string; found_on: string; risk_level: string | null;
  department_name: string | null; indicator_id: string | null; created_by_name: string | null; action_count: number;
  open_action_count: number; next_due_on: string | null; overdue_action_count: number };

async function Improvements({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { sb } = await requireMe();
  const { data } = await sb.from('v_findings').select('*').order('found_on', { ascending: false });
  const all = (data ?? []) as F[];
  const list = status ? all.filter((f) => f.status === status) : all.filter((f) => f.status !== '已結案');
  const chip = (label: string, href: string, on: boolean, n?: number) => (
    <Link href={href} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>{label}{n !== undefined && <> <b>{n}</b></>}</Link>
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">缺失與改善</h1>
          <p className="text-sm text-muted">缺失 → 改善措施（唯一主責、期限）→ 全部完成後由主任做成效複核 → 有效才結案；無效會退回重新改善。</p>
        </div>
        <Link href="/improvements/new" className="btn-primary">提報缺失</Link>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="狀態">
        {chip('未結案', '/improvements', !status, all.filter((f) => f.status !== '已結案').length)}
        {STATUSES.map((s) => <span key={s}>{chip(s, `/improvements?status=${s}`, status === s, all.filter((f) => f.status === s).length)}</span>)}
      </nav>
      <section className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-paper"><tr><th className="th">缺失</th><th className="th">來源</th><th className="th">指標</th><th className="th">組別</th><th className="th">狀態</th><th className="th">措施</th><th className="th">最近期限</th></tr></thead>
          <tbody className="divide-y divide-line">{list.map((f) => (
            <tr key={f.id}>
              <td className="td"><Link href={`/improvements/item?id=${encodeURIComponent(f.id)}`} className="font-medium hover:underline">{f.summary}</Link>
                <div className="text-xs text-muted">{f.id}・{fmtDate(f.found_on)}・{f.created_by_name}{f.risk_level && `・風險 ${f.risk_level}`}</div></td>
              <td className="td whitespace-nowrap">{f.source}</td>
              <td className="td">{f.indicator_id ? <Link href={`/evaluation/item?id=${encodeURIComponent(f.indicator_id)}`} className="text-accent">{f.indicator_id}</Link> : '—'}</td>
              <td className="td whitespace-nowrap">{f.department_name ?? '—'}</td>
              <td className="td"><Badge>{f.status}</Badge></td>
              <td className="td tabular-nums whitespace-nowrap">{f.action_count - f.open_action_count}/{f.action_count}{f.overdue_action_count > 0 && <div className="text-xs text-danger">逾期 {f.overdue_action_count}</div>}</td>
              <td className="td whitespace-nowrap">{fmtDate(f.next_due_on)}</td>
            </tr>
          ))}{!list.length && <tr><td className="td text-muted" colSpan={7}>沒有符合條件、且你有權檢視的缺失。</td></tr>}</tbody>
        </table>
      </section>
      <p className="text-xs text-muted">只顯示你有權檢視的缺失：主任、提報人、該組組長與評鑑統籌、改善措施主責。</p>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Improvements as PageLoader} title="缺失與改善" />;
}
