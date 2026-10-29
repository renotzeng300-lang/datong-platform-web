'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { requireDirector } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';

async function Audit({ searchParams }: { searchParams: Promise<{ table?: string; record?: string }> }) {
  const sp = await searchParams;
  const { sb } = await requireDirector();
  let q = sb.from('audit_logs').select('*').order('id', { ascending: false }).limit(200);
  if (sp.table) q = q.eq('table_name', sp.table);
  if (sp.record) q = q.eq('record_id', sp.record);
  const { data } = await q;
  return (
    <div className="space-y-5">
      <header><h1 className="h1">操作日誌</h1><p className="text-sm text-muted">由資料庫自動寫入，任何人（含主任）都無法修改或刪除。長文字只保留前 80 字摘要。</p></header>
      <form method="get" className="card flex flex-wrap items-end gap-3 p-3">
        <div><label className="label" htmlFor="table">資料表</label><input id="table" name="table" defaultValue={sp.table} className="field" placeholder="tasks" /></div>
        <div><label className="label" htmlFor="record">紀錄 ID</label><input id="record" name="record" defaultValue={sp.record} className="field" /></div>
        <button className="btn-ghost">查詢</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-paper"><tr><th className="th">時間</th><th className="th">操作者</th><th className="th">動作</th><th className="th">資料</th><th className="th">變更內容</th></tr></thead>
          <tbody className="divide-y divide-line">{(data ?? []).map((l) => (
            <tr key={l.id}>
              <td className="td whitespace-nowrap">{fmtDateTime(l.at)}</td>
              <td className="td whitespace-nowrap">{l.actor_person_id ?? l.actor_role}</td>
              <td className="td">{l.action}</td>
              <td className="td whitespace-nowrap">{l.table_name}<div className="text-xs text-muted">{l.record_id}</div></td>
              <td className="td"><code className="block max-w-xl whitespace-pre-wrap break-all text-xs">{l.action === 'update' ? Object.keys(l.after_summary ?? {}).map((k) => `${k}: ${JSON.stringify(l.before_summary?.[k])} → ${JSON.stringify(l.after_summary[k])}`).join('\n') : JSON.stringify(l.after_summary ?? l.before_summary).slice(0, 300)}</code>{l.note && <div className="text-xs text-muted">{l.note}</div>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Audit as PageLoader} title="操作日誌" />;
}
