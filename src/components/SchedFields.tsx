'use client';
import { useState } from 'react';

/** 工作「執行時程」欄位（選填）：有填就會出現在排程總覽主責與協作的格子 */
export function SchedFields() {
  const [from, setFrom] = useState('');
  const [period, setPeriod] = useState('全天');
  return (
    <fieldset className="rounded-lg border border-line p-3 md:col-span-2">
      <legend className="px-1 text-sm font-semibold">執行時程（選填）</legend>
      <p className="hint mb-2">哪天、什麼時段要去做（例如家訪、開會、活動）。有填就會同步顯示在「排程總覽」。</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="sched_from">開始日期</label>
          <input id="sched_from" name="sched_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" /></div>
        <div><label className="label" htmlFor="sched_to">結束日期</label>
          <input id="sched_to" name="sched_to" type="date" min={from || undefined} disabled={!from} className="field" placeholder="同開始日" /></div>
        <div><label className="label" htmlFor="sched_period">時段</label>
          <select id="sched_period" name="sched_period" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!from} className="field">
            <option>全天</option><option>上午</option><option>下午</option><option value="時段">指定時間</option>
          </select></div>
        {period === '時段' && from && (
          <>
            <div><label className="label" htmlFor="sched_time_from">開始時間</label><input id="sched_time_from" name="sched_time_from" type="time" required className="field" /></div>
            <div><label className="label" htmlFor="sched_time_to">結束時間</label><input id="sched_time_to" name="sched_time_to" type="time" required className="field" /></div>
          </>
        )}
      </div>
    </fieldset>
  );
}
