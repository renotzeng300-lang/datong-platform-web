'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { fmtDate } from '@/lib/format';

const STATUSES = ['待審核', '退回補正', '有效', '已失效'] as const;

type E = { id: string; title: string; doc_type: string | null; year_label: string | null; sensitivity: string;
  storage_kind: string; department_name: string | null; status: string; uploaded_by_name: string | null;
  indicator_ids: string[]; created_at: string; reviewed_on: string | null };

async function EvidenceList({ searchParams }: { searchParams: Promise<{ status?: string; indicator?: string }> }) {
  const { status, indicator } = await searchParams;
  const { me, sb } = await requireMe();
  let q = sb.from('v_evidence').select('*').order('created_at', { ascending: false });
  if (indicator) q = q.contains('indicator_ids', [indicator]);
  const { data } = await q;
  const all = (data ?? []) as E[];
  const list = status ? all.filter((e) => e.status === status) : all.filter((e) => e.status !== '已失效');
  const qs = (s?: string) => {
    const p = new URLSearchParams();
    if (s) p.set('status', s);
    if (indicator) p.set('indicator', indicator);
    const t = p.toString();
    return t ? `/evidence?${t}` : '/evidence';
  };
  const chip = (label: string, href: string, on: boolean, n: number) => (
    <Link href={href} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card'}`}>{label} <b>{n}</b></Link>
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">佐證索引{indicator && <span className="text-muted">｜指標 {indicator}</span>}</h1>
          <p className="text-sm text-muted">檔案放在中心的 Google 雲端硬碟或實體檔案櫃，平台只記索引。連結只有授權者調閱時才看得到，每次調閱都留紀錄。</p>
        </div>
        <Link href={indicator ? `/evidence/new?indicator=${indicator}` : '/evidence/new'} className="btn-primary">登錄佐證</Link>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="狀態">
        {chip('使用中', qs(), !status, all.filter((e) => e.status !== '已失效').length)}
        {STATUSES.map((s) => <span key={s}>{chip(s, qs(s), status === s, all.filter((e) => e.status === s).length)}</span>)}
        {indicator && <Link href={status ? `/evidence?status=${status}` : '/evidence'} className="rounded-full border border-line px-3 py-1 text-sm text-accent">清除指標篩選</Link>}
      </nav>
      <section className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-paper"><tr><th className="th">佐證</th><th className="th">存放</th><th className="th">密級</th><th className="th">關聯指標</th><th className="th">組別</th><th className="th">狀態</th></tr></thead>
          <tbody className="divide-y divide-line">{list.map((e) => (
            <tr key={e.id}>
              <td className="td"><Link href={`/evidence/item?id=${encodeURIComponent(e.id)}`} className="font-medium hover:underline">{e.title}</Link>
                <div className="text-xs text-muted">{[e.year_label && `${e.year_label} 年度`, e.doc_type, e.uploaded_by_name, fmtDate(e.created_at)].filter(Boolean).join('・')}</div></td>
              <td className="td whitespace-nowrap text-sm">{e.storage_kind}</td>
              <td className="td"><Badge>{e.sensitivity}</Badge></td>
              <td className="td text-sm">{e.indicator_ids.length
                ? e.indicator_ids.map((i, n) => <span key={i}>{n > 0 && '、'}<Link href={`/evaluation/item?id=${encodeURIComponent(i)}`} className="text-accent">{i}</Link></span>)
                : '—'}</td>
              <td className="td whitespace-nowrap">{e.department_name ?? '—'}</td>
              <td className="td"><Badge>{e.status}</Badge>{e.reviewed_on && <div className="text-xs text-muted">{fmtDate(e.reviewed_on)}</div>}</td>
            </tr>
          ))}{!list.length && <tr><td className="td text-muted" colSpan={6}>沒有符合條件、且你有權檢視的佐證。</td></tr>}</tbody>
        </table>
      </section>
      <p className="text-xs text-muted">
        {me.is_director ? '主任可看到全部一般內部與限組別佐證；高度限制佐證需個別授權。' : '只顯示你登錄的、與你的工作相關的，或已授權你調閱的佐證。'}
      </p>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={EvidenceList as PageLoader} title="佐證索引" />;
}
