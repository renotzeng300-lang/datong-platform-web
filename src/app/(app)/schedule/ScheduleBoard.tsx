'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';
import { periodLabel, WEEKDAY, weekday, type ScheduleEntry, type ScheduleView } from '@/lib/schedule';

export type Person = { id: string; name: string; title: string | null; department_id: string };
type Cat = '公事' | '請假';
type Draft = {
  id: number | null; person_id: string; date_from: string; date_to: string; category: Cat; item_type: string;
  period: ScheduleEntry['period']; time_from: string; time_to: string; note: string; updated_at: string | null;
};

const chipClass = (c: Cat) => c === '請假'
  ? 'border-l-4 border-danger bg-danger-soft text-danger'
  : 'border-l-4 border-accent bg-accent-soft text-accent';

/** 排程表：列＝同仁（依組別分組）、欄＝日期；主任可點格子新增、點色塊修改 */
export function ScheduleBoard({ view, days, today, people, depts, entries, isDirector, types }: {
  view: ScheduleView; days: string[]; today: string; people: Person[]; depts: { id: string; name: string }[];
  entries: ScheduleEntry[]; isDirector: boolean; types: Record<Cat, string[]>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const groups = depts.map((d) => ({ d, list: people.filter((p) => p.department_id === d.id) })).filter((g) => g.list.length);
  const others = people.filter((p) => !depts.some((d) => d.id === p.department_id));
  if (others.length) groups.push({ d: { id: '_', name: '其他' }, list: others });
  const byPerson = new Map<string, ScheduleEntry[]>();
  for (const e of entries) byPerson.set(e.person_id, [...(byPerson.get(e.person_id) ?? []), e]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const compact = view === 'month';

  const openNew = (person: string, day: string) => setDraft({
    id: null, person_id: person, date_from: day, date_to: day, category: '公事', item_type: types['公事'][0] ?? '外出',
    period: '全天', time_from: '', time_to: '', note: '', updated_at: null,
  });
  const openEdit = (e: ScheduleEntry) => setDraft({
    id: e.id, person_id: e.person_id, date_from: e.date_from, date_to: e.date_to, category: e.category, item_type: e.item_type,
    period: e.period, time_from: e.time_from?.slice(0, 5) ?? '', time_to: e.time_to?.slice(0, 5) ?? '', note: e.note ?? '', updated_at: e.updated_at,
  });
  const describe = (e: ScheduleEntry) => [
    `${nameOf(e.person_id)}｜${e.category}：${e.item_type}`,
    e.date_from === e.date_to ? e.date_from : `${e.date_from} ～ ${e.date_to}`,
    periodLabel(e), e.note ?? '',
  ].filter(Boolean).join('\n');

  return (
    <>
      <div className="card overflow-x-auto" data-schedule>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">排程總覽：列為同仁，欄為日期</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-20 min-w-24 border-b border-r border-line bg-card px-2 py-2 text-left">同仁</th>
              {days.map((d) => {
                const wd = weekday(d); const weekend = wd === 0 || wd === 6;
                return (
                  <th key={d} scope="col" className={`border-b border-line px-1 py-1 text-center font-normal ${compact ? 'min-w-11' : 'min-w-28'} ${weekend ? 'bg-paper text-muted' : ''} ${d === today ? 'bg-brand-yellow-soft' : ''}`}>
                    <div className={`font-semibold ${d === today ? 'text-ink' : ''}`}>{compact ? Number(d.slice(8)) : `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}</div>
                    <div className="text-xs">{WEEKDAY[wd]}{d === today && !compact ? '・今天' : ''}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map(({ d, list }) => (
            <tbody key={d.id}>
              <tr><th scope="rowgroup" colSpan={days.length + 1} className="sticky left-0 bg-paper px-2 py-1 text-left text-xs font-semibold text-muted">{d.name}</th></tr>
              {list.map((p) => {
                const mine = byPerson.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="align-top">
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-card px-2 py-1 text-left font-medium">
                      {p.name}{p.title && !compact && <span className="block text-xs font-normal text-muted">{p.title}</span>}
                    </th>
                    {days.map((day) => {
                      const wd = weekday(day); const weekend = wd === 0 || wd === 6;
                      const here = mine.filter((e) => e.date_from <= day && e.date_to >= day);
                      return (
                        <td key={day} className={`relative border-b border-line p-0.5 ${weekend ? 'bg-paper' : ''} ${day === today ? 'bg-brand-yellow-soft/60' : ''}`}>
                          <div className="flex min-h-10 flex-col gap-0.5">
                            {here.map((e) => {
                              const label = compact ? e.item_type.slice(0, 2) : e.item_type;
                              const sub = periodLabel(e);
                              const content = (
                                <>
                                  <span className="font-semibold">{label}</span>
                                  {sub && !(compact && e.period === '時段') && <span className="ml-1 text-[11px] opacity-80">{sub}</span>}
                                  {!compact && e.note && <span className="block truncate text-[11px] text-ink/70">{e.note}</span>}
                                </>
                              );
                              return isDirector ? (
                                <button key={e.id} type="button" onClick={() => openEdit(e)} title={describe(e)}
                                        aria-label={`修改：${describe(e).replaceAll('\n', '，')}`}
                                        className={`w-full rounded px-1 py-0.5 text-left text-xs leading-tight ${chipClass(e.category)}`}>{content}</button>
                              ) : (
                                <div key={e.id} title={describe(e)} className={`rounded px-1 py-0.5 text-xs leading-tight ${chipClass(e.category)}`}>
                                  {content}<span className="sr-only">（{describe(e).replaceAll('\n', '，')}）</span>
                                </div>
                              );
                            })}
                            {isDirector && (
                              <button type="button" onClick={() => openNew(p.id, day)}
                                      aria-label={`新增 ${p.name} ${day} 的排程`}
                                      className="min-h-6 flex-1 rounded text-xs text-muted opacity-0 hover:bg-accent-soft hover:opacity-100 focus:opacity-100">＋</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      {!people.length && <p className="text-sm text-muted">目前沒有在職同仁資料。</p>}
      {isDirector && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={() => openNew(people[0]?.id ?? '', today)}>＋ 登記排程</button>
        </div>
      )}
      {draft && <EntryDialog draft={draft} people={people} depts={depts} types={types} onClose={() => setDraft(null)} />}
    </>
  );
}

function EntryDialog({ draft, people, depts, types, onClose }: {
  draft: Draft; people: Person[]; depts: { id: string; name: string }[]; types: Record<Cat, string[]>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState<Draft>(draft);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  useEffect(() => { ref.current?.showModal(); }, []);
  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => { setV((o) => ({ ...o, [k]: val })); setResult(null); };
  const sb = supabaseBrowser();

  const save = () => start(async () => {
    const { error } = await sb.rpc('schedule_save', {
      p_id: v.id, p_person: v.person_id, p_date_from: v.date_from, p_date_to: v.date_to || v.date_from,
      p_category: v.category, p_item_type: v.item_type, p_period: v.period,
      p_time_from: v.period === '時段' ? v.time_from || null : null, p_time_to: v.period === '時段' ? v.time_to || null : null,
      p_note: v.note, p_expected_updated_at: v.updated_at,
    });
    if (error) { setResult(fromError(error, '')); return; }
    refresh(); onClose();
  });
  const remove = () => start(async () => {
    if (!window.confirm('確定刪除這筆排程？（會保留在操作日誌）')) return;
    const { error } = await sb.rpc('schedule_delete', { p_id: v.id, p_reason: null });
    if (error) { setResult(fromError(error, '')); return; }
    refresh(); onClose();
  });

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="sch-h"
            className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 text-ink backdrop:bg-black/40">
      <form method="dialog" className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 id="sch-h" className="h2">{v.id ? '修改排程' : '登記排程'}</h2>
        <fieldset disabled={pending} className="space-y-3">
          <div><label className="label" htmlFor="sch-person">同仁</label>
            <select id="sch-person" value={v.person_id} onChange={(e) => set('person_id', e.target.value)} required className="field">
              {depts.map((d) => {
                const list = people.filter((p) => p.department_id === d.id);
                return list.length ? <optgroup key={d.id} label={d.name}>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup> : null;
              })}
            </select></div>
          <fieldset>
            <legend className="label">類別</legend>
            <div className="flex gap-2">
              {(['公事', '請假'] as Cat[]).map((c) => (
                <label key={c} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 ${v.category === c ? chipClass(c) : 'border border-line'}`}>
                  <input type="radio" name="sch-cat" value={c} checked={v.category === c}
                         onChange={() => { set('category', c); set('item_type', types[c][0] ?? ''); }} />{c}
                </label>
              ))}
            </div>
          </fieldset>
          <div><label className="label" htmlFor="sch-type">{v.category === '請假' ? '假別' : '項目'}</label>
            <select id="sch-type" value={v.item_type} onChange={(e) => set('item_type', e.target.value)} className="field">
              {[...new Set([...(types[v.category] ?? []), v.item_type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="sch-from">開始日期</label>
              <input id="sch-from" type="date" value={v.date_from} required className="field"
                     onChange={(e) => { const d = e.target.value; setV((o) => ({ ...o, date_from: d, date_to: o.date_to < d ? d : o.date_to })); setResult(null); }} /></div>
            <div><label className="label" htmlFor="sch-to">結束日期</label>
              <input id="sch-to" type="date" value={v.date_to} min={v.date_from} required className="field" onChange={(e) => set('date_to', e.target.value)} /></div>
          </div>
          <div><label className="label" htmlFor="sch-period">時段</label>
            <select id="sch-period" value={v.period} onChange={(e) => set('period', e.target.value as Draft['period'])} className="field">
              <option>全天</option><option>上午</option><option>下午</option><option value="時段">指定時間</option>
            </select></div>
          {v.period === '時段' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="sch-tf">開始時間</label><input id="sch-tf" type="time" value={v.time_from} required onChange={(e) => set('time_from', e.target.value)} className="field" /></div>
              <div><label className="label" htmlFor="sch-tt">結束時間</label><input id="sch-tt" type="time" value={v.time_to} required onChange={(e) => set('time_to', e.target.value)} className="field" /></div>
            </div>
          )}
          <div><label className="label" htmlFor="sch-note">備註（選填）</label>
            <input id="sch-note" value={v.note} maxLength={200} onChange={(e) => set('note', e.target.value)} className="field"
                   placeholder={v.category === '請假' ? '只有主任看得到；請勿寫病因等個資' : '地點或事由，全員看得到，例如：社會局開會'} /></div>
        </fieldset>
        {result && !result.ok && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{result.message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>{v.id && <button type="button" onClick={remove} disabled={pending} className="btn-ghost text-danger">刪除</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost">取消</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? '儲存中…' : '儲存'}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
