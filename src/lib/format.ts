// 日期一律以臺北時區顯示；資料庫以 ISO（西元）儲存
const TZ = 'Asia/Taipei';

export function fmtDate(d: string | null | undefined, roc = false): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y) return d;
  return roc ? `${y - 1911}/${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}` : `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));
}

export function dueLabel(days: number | null | undefined, closed: boolean): string {
  if (closed || days === null || days === undefined) return '';
  if (days < 0) return `逾期 ${-days} 天`;
  if (days === 0) return '今天到期';
  return `${days} 天後`;
}

export const ROLE_LABEL: Record<string, string> = {
  director: '主任',
  dept_lead: '組長',
  business_owner: '業務負責人',
  staff: '一般承辦人',
  eval_coordinator: '評鑑統籌',
  sysadmin: '技術維護',
};

export const TASK_STATUSES = ['待分派', '待處理', '進行中', '受阻', '待外部回覆', '待主管核定', '已結案', '已取消'] as const;

/** 臺北時區的今天（YYYY-MM-DD），與資料庫 app_today() 一致 */
export function todayTaipei(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
}
