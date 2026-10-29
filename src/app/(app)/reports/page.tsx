'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { redirect, requireMe } from '@/lib/session';
import { periods } from '@/lib/report';
import { todayTaipei } from '@/lib/format';
import { useState } from 'react';
import { DownloadButton } from '@/components/DownloadButton';

function CustomReport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayTaipei());
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div><label className="label" htmlFor="from">開始日</label><input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" /></div>
      <div><label className="label" htmlFor="to">結束日</label><input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field" /></div>
      <DownloadButton job={{ kind: 'report', period: 'custom', from, to }} className="btn-primary">下載</DownloadButton>
    </div>
  );
}

async function Reports() {
  const { me } = await requireMe();
  if (!me.is_director && !me.roles.some((r) => r.role === 'dept_lead')) redirect('/no-access?reason=director');
  const ps = periods();
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="h1">週報／月報</h1>
        <p className="text-sm text-muted">下載 Excel：摘要、工作進度、本期回報、承辦人負荷、評鑑檢核、缺失改善、佐證索引。所有數字由系統即時計算，只含你有權限查看的資料；每次下載都會記入操作日誌。</p>
      </header>
      <section className="card p-5" aria-labelledby="qhead">
        <h2 id="qhead" className="h2 mb-3">快速下載</h2>
        <ul className="grid gap-3 sm:grid-cols-2">{ps.map((p) => (
          <li key={p.key}>
            <DownloadButton job={{ kind: 'report', period: p.key }} className="card flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left hover:border-accent">
              <span><b>{p.label}報</b><span className="block text-xs text-muted">{p.from} ～ {p.to}</span></span>
              <span aria-hidden className="text-accent">⬇</span>
            </DownloadButton>
          </li>
        ))}</ul>
      </section>
      <section className="card p-5" aria-labelledby="chead">
        <h2 id="chead" className="h2 mb-3">自訂期間</h2>
        <CustomReport />
      </section>
      <p className="text-xs text-muted">「自評符合」是內部自評，不是官方評鑑分數；報表內不含佐證連結。</p>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Reports as PageLoader} title="週報／月報" />;
}
