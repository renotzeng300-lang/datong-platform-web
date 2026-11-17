'use client';
import Link from 'next/link';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { requireMe } from '@/lib/session';
import { todayTaipei } from '@/lib/format';
import { isYmd, rangeOf, rangeTitle, shift, type ScheduleEntry, type ScheduleView } from '@/lib/schedule';
import { ScheduleBoard, type Person } from './ScheduleBoard';

type Search = { view?: string; d?: string };

async function Schedule({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { sb, me } = await requireMe();
  const today = todayTaipei();
  const view: ScheduleView = sp.view === 'month' ? 'month' : 'week';
  const anchor = isYmd(sp.d) ? sp.d! : today;
  const { from, to, days } = rangeOf(view, anchor);
  const [{ data: ppl, error: e1 }, { data: depts }, { data: rows, error: e2 }, { data: types }, { data: todayRows }] = await Promise.all([
    sb.rpc('people_picker'),
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    sb.rpc('schedule_range', { p_from: from, p_to: to }),
    sb.rpc('schedule_types'),
    sb.rpc('schedule_range', { p_from: today, p_to: today }),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  const people = (ppl ?? []) as Person[];
  const entries = (rows ?? []) as ScheduleEntry[];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const away = ((todayRows ?? []) as ScheduleEntry[]);
  const link = (v: ScheduleView, d: string) => `/schedule?view=${v}&d=${d}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">排程總覽</h1>
          <p className="text-sm text-muted">誰在哪、誰不在，一眼看清楚。{me.is_director ? '點格子新增，點色塊修改或刪除。' : '排程由主任登記。'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="切換檢視">
          <Link href={link('week', anchor)} aria-current={view === 'week' ? 'page' : undefined}
                className={view === 'week' ? 'btn-primary' : 'btn-ghost'}>週</Link>
          <Link href={link('month', anchor)} aria-current={view === 'month' ? 'page' : undefined}
                className={view === 'month' ? 'btn-primary' : 'btn-ghost'}>月</Link>
        </div>
      </header>

      <section className="card p-4" aria-labelledby="away-h">
        <h2 id="away-h" className="h2 mb-2">今天（{today.slice(5).replace('-', '/')}）不在或外出</h2>
        {away.length ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {away.map((e) => (
              <li key={e.id} className={`rounded-full px-3 py-1 ${e.category === '請假' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'}`}>
                <b>{nameOf(e.person_id)}</b>・{e.item_type}{e.period !== '全天' ? `（${e.period === '時段' ? `${e.time_from?.slice(0, 5)}–${e.time_to?.slice(0, 5)}` : e.period}）` : ''}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">今天全員在中心。</p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={link(view, shift(view, anchor, -1))} className="btn-ghost" aria-label={view === 'week' ? '上一週' : '上一個月'}>‹</Link>
          <span className="min-w-40 text-center font-semibold">{rangeTitle(view, from, to)}</span>
          <Link href={link(view, shift(view, anchor, 1))} className="btn-ghost" aria-label={view === 'week' ? '下一週' : '下一個月'}>›</Link>
          <Link href={link(view, today)} className="btn-ghost">今天</Link>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs" aria-label="圖例">
          <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-3 w-3 rounded-sm border-l-4 border-accent bg-accent-soft" />公事</li>
          <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-3 w-3 rounded-sm border-l-4 border-danger bg-danger-soft" />請假（顯示假別）</li>
          <li className="flex items-center gap-1"><span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-paper ring-1 ring-line" />週末</li>
        </ul>
      </div>

      <ScheduleBoard view={view} days={days} today={today} people={people} depts={(depts ?? []) as { id: string; name: string }[]}
                     entries={entries} isDirector={me.is_director} types={(types ?? { 公事: [], 請假: [] }) as Record<'公事' | '請假', string[]>} />
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Schedule as PageLoader} title="排程總覽" />;
}
