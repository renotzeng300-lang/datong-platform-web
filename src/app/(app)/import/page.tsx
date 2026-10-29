'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { requireDirector } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { fmtDateTime } from '@/lib/format';
import { commitImport } from './actions';

type Issue = { id: number; sheet: string | null; row_no: number | null; severity: string; code: string; message: string };
type Plan = { target: string; sheet: string; new: number; existing: number };

async function ImportPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams;
  const { sb } = await requireDirector();
  const { data: batches } = await sb.from('import_batches').select('*').order('id', { ascending: false }).limit(20);
  const current = batch ? Number(batch) : batches?.[0]?.id;
  const { data: preview } = current ? await sb.rpc('import_preview', { p_batch: current }) : { data: null };
  const issues = (preview?.issues ?? []) as Issue[];
  const b = preview?.batch;
  const grouped = issues.reduce<Record<string, Issue[]>>((acc, i) => ((acc[i.code] ??= []).push(i), acc), {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">資料匯入（staging → 驗證 → 預覽 → 主任確認）</h1>
        <p className="text-sm text-muted">
          匯入工具（<code>npm run import:v5</code>）只會把工作簿放進暫存區並驗證，不會寫入正式資料。主任在此檢視差異與問題清單後按「確認匯入」才生效。
          匯入不會把任何「待主任核定／待分派」變成正式交辦，也不會因沒有 Email 建立假帳號。
        </p>
      </header>
      {!batches?.length && <p className="card p-6 text-muted">目前沒有匯入批次。請技術維護人員執行匯入工具。</p>}
      {!!batches?.length && (
        <section className="card overflow-x-auto">
          <table className="w-full"><thead className="bg-paper"><tr><th className="th">批次</th><th className="th">檔案</th><th className="th">狀態</th><th className="th">錯誤／警告／提醒</th><th className="th">建立</th><th className="th">確認</th></tr></thead>
            <tbody className="divide-y divide-line">{batches.map((x) => (
              <tr key={x.id} className={x.id === current ? 'bg-accent-soft/50' : ''}>
                <td className="td"><a href={`/import?batch=${x.id}`} className="text-accent">#{x.id}</a></td>
                <td className="td text-sm">{x.source_file}<div className="text-xs text-muted">SHA-256 {String(x.file_sha256).slice(0, 12)}…</div></td>
                <td className="td"><Badge tone={x.status === '已匯入' ? '已核定' : x.status === '驗證失敗' ? '退回' : '待主任核定'}>{x.status}</Badge></td>
                <td className="td tabular-nums">{x.summary?.errors ?? '—'}／{x.summary?.warnings ?? '—'}／{x.summary?.notes ?? '—'}</td>
                <td className="td text-sm">{fmtDateTime(x.created_at)}</td>
                <td className="td text-sm">{x.committed_at ? `${x.committed_by} ${fmtDateTime(x.committed_at)}` : '—'}</td>
              </tr>
            ))}</tbody></table>
        </section>
      )}
      {preview && (
        <>
          <section className="card overflow-x-auto">
            <h2 className="h2 border-b border-line px-4 py-3">批次 #{current} 預計異動</h2>
            <table className="w-full"><thead className="bg-paper"><tr><th className="th">目標</th><th className="th">來源工作表</th><th className="th text-right">新增</th><th className="th text-right">已存在（不覆寫）</th></tr></thead>
              <tbody className="divide-y divide-line">{(preview.plan as Plan[]).map((p) => (
                <tr key={p.target}><td className="td">{p.target}</td><td className="td text-sm text-muted">{p.sheet}</td><td className="td text-right tabular-nums">{p.new}</td><td className="td text-right tabular-nums">{p.existing}</td></tr>
              ))}</tbody></table>
            <div className="border-t border-line p-4 text-sm text-muted"><b>不匯入：</b><ul className="ml-5 list-disc">{(preview.not_imported as string[]).map((s) => <li key={s}>{s}</li>)}</ul></div>
          </section>
          <section className="card p-4">
            <h2 className="h2 mb-3">問題清單</h2>
            <div className="space-y-2">{Object.entries(grouped).map(([code, list]) => (
              <details key={code} className="rounded-lg border border-line p-3" open={list[0].severity === '錯誤'}>
                <summary className="cursor-pointer"><Badge tone={list[0].severity === '錯誤' ? '退回' : list[0].severity === '警告' ? '待確認' : undefined}>{list[0].severity}</Badge> <b className="ml-1">{code}</b> <span className="text-sm text-muted">× {list.length}</span>　<span className="text-sm">{list[0].message}</span></summary>
                <ul className="mt-2 space-y-1 text-sm">{list.map((i) => <li key={i.id}>{i.sheet} {i.row_no ? `第 ${i.row_no} 列` : ''}：{i.message}</li>)}</ul>
              </details>
            ))}</div>
          </section>
          {b?.status === '已匯入' && (
            <p role="status" className="card border-l-4 border-l-ok p-4 text-ok">批次 #{current} 已於 {fmtDateTime(b.committed_at)} 由 {b.committed_by} 確認匯入。匯入的教保任務與評鑑分工仍為「待主任核定」，請至「待核定」逐筆核定。</p>
          )}
          {b?.status === '已驗證' && (
            <ActionForm action={commitImport} confirm="確認匯入正式資料表？所有任務仍維持「待主任核定」。" className="card border-l-4 border-l-accent p-4">
              <input type="hidden" name="batch" value={current} />
              <p className="mb-3 text-sm">我已檢視上述差異與問題清單，確認匯入批次 #{current}。</p>
              <Submit>確認匯入</Submit>
            </ActionForm>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={ImportPage as PageLoader} title="資料匯入" />;
}
