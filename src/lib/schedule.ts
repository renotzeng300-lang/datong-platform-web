// 排程總覽：日期計算（一律以 YYYY-MM-DD 字串、UTC 計算，避免時區誤差）
export type ScheduleEntry = {
  id: number; person_id: string; date_from: string; date_to: string; category: '公事' | '請假'; item_type: string;
  period: '全天' | '上午' | '下午' | '時段'; time_from: string | null; time_to: string | null; note: string | null; updated_at: string;
};
export type ScheduleView = 'week' | 'month';

const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const isYmd = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const weekday = (s: string) => toDate(s).getUTCDay(); // 0＝日
export const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** 週：週一到週日；月：1 日到月底 */
export function rangeOf(view: ScheduleView, anchor: string): { from: string; to: string; days: string[] } {
  let from: string; let to: string;
  if (view === 'week') {
    from = addDays(anchor, -((weekday(anchor) + 6) % 7));
    to = addDays(from, 6);
  } else {
    from = `${anchor.slice(0, 7)}-01`;
    const d = toDate(from); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    to = ymd(d);
  }
  const days: string[] = [];
  for (let s = from; s <= to; s = addDays(s, 1)) days.push(s);
  return { from, to, days };
}

/** 上一期／下一期的錨點日期 */
export function shift(view: ScheduleView, anchor: string, dir: 1 | -1): string {
  if (view === 'week') return addDays(anchor, 7 * dir);
  const d = toDate(`${anchor.slice(0, 7)}-01`); d.setUTCMonth(d.getUTCMonth() + dir);
  return ymd(d);
}

export function periodLabel(e: Pick<ScheduleEntry, 'period' | 'time_from' | 'time_to'>): string {
  if (e.period === '時段') return `${(e.time_from ?? '').slice(0, 5)}–${(e.time_to ?? '').slice(0, 5)}`;
  return e.period === '全天' ? '' : e.period;
}

export function rangeTitle(view: ScheduleView, from: string, to: string): string {
  const [y, m] = from.split('-');
  if (view === 'month') return `${y} 年 ${Number(m)} 月`;
  return `${from.replaceAll('-', '/')} – ${to.slice(5).replace('-', '/')}`;
}

/** 排程總覽上的工作：執行時程（主責、協作）或期限（主責） */
export type ScheduleTask = {
  task_id: string; title: string; can_open: boolean; person_id: string; role: '主責' | '協作'; kind: '執行' | '期限';
  date_from: string; date_to: string; period: ScheduleEntry['period']; time_from: string | null; time_to: string | null; status: string;
};

/** 工作執行時程的文字，例如「2026-11-20 下午」「2026-11-20～2026-11-21」「2026-11-20 14:00–16:00」 */
export function taskSchedLabel(t: { sched_from: string | null; sched_to: string | null; sched_period: string | null; sched_time_from: string | null; sched_time_to: string | null }): string {
  if (!t.sched_from) return '';
  const range = t.sched_to && t.sched_to !== t.sched_from ? `${t.sched_from}～${t.sched_to}` : t.sched_from;
  const per = t.sched_period === '時段' ? `${(t.sched_time_from ?? '').slice(0, 5)}–${(t.sched_time_to ?? '').slice(0, 5)}` : t.sched_period === '全天' ? '' : t.sched_period ?? '';
  return per ? `${range} ${per}` : range;
}
