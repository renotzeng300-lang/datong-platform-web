// 主任／組長週報、月報：所有數字由資料即時計算，查詢一律用登入者自己的權限（RLS）。
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskRow } from './types';

const TZ = 'Asia/Taipei';
const day = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export type Period = { key: string; label: string; from: string; to: string };

/** 期間：本週、上週（週一到週日）、本月、上月；自訂期間由呼叫端驗證 */
export function periods(now = new Date()): Period[] {
  const today = day(now);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 週一＝0
  const monday = addDays(today, -dow);
  const [y, m] = today.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  return [
    { key: 'this-week', label: '本週', from: monday, to: today },
    { key: 'last-week', label: '上週', from: addDays(monday, -7), to: addDays(monday, -1) },
    { key: 'this-month', label: '本月', from: first, to: today },
    { key: 'last-month', label: '上月', from: prevFirst, to: addDays(first, -1) },
  ];
}

const inPeriod = (ts: string | null | undefined, p: Period) => !!ts && day(new Date(ts.length <= 10 ? `${ts}T00:00:00+08:00` : ts)) >= p.from && day(new Date(ts.length <= 10 ? `${ts}T00:00:00+08:00` : ts)) <= p.to;
const OPEN = (t: TaskRow) => !['已結案', '已取消'].includes(t.status) && t.approval_status !== '退回';

type Cell = string | number | null;
type Sheet = { sheet: string; data: Cell[][]; widths: number[] };

export async function buildReport(sb: SupabaseClient, p: Period, who: string) {
  const [{ data: t }, { data: u }, { data: inds }, { data: q }, { data: f }, { data: ev }] = await Promise.all([
    sb.from('v_tasks').select('*').is('archived_at', null).limit(5000),
    sb.from('v_task_updates').select('task_id,author_name,report_type,kind,status_from,status_to,next_action,next_action_due_on,created_at')
      .gte('created_at', `${p.from}T00:00:00+08:00`).lte('created_at', `${p.to}T23:59:59+08:00`).order('created_at').limit(5000),
    sb.from('v_indicators').select('id,name,dimension_name,applicability_status,assignment_approval_status,owner_name').order('official_seq').order('id'),
    sb.from('v_indicator_quality').select('*'),
    sb.from('v_findings').select('*').order('found_on'),
    sb.from('v_evidence').select('id,title,year_label,storage_kind,sensitivity,status,department_name,indicator_ids,created_at').order('created_at'),
  ]);
  const tasks = (t ?? []) as TaskRow[];
  const title = new Map(tasks.map((x) => [x.id, x.title]));
  const open = tasks.filter(OPEN);
  const stale = open.filter((x) => x.approval_status === '已核定' && x.last_activity_at && (Date.now() - new Date(x.last_activity_at).getTime()) > 7 * 864e5);
  const qmap = new Map((q ?? []).map((r) => [r.id as string, r]));
  const sum = (k: string) => (q ?? []).reduce((n, r) => n + Number(r[k] ?? 0), 0);
  const findings = f ?? [];
  const evidence = ev ?? [];

  const kpi: Cell[][] = [
    ['項目', '數量', '說明'],
    ['報表期間', `${p.from} ～ ${p.to}`, p.label],
    ['未結案工作', open.length, '待分派、待處理、進行中、受阻、待外部回覆、待主管核定'],
    ['已逾期', open.filter((x) => x.is_overdue).length, '依期限計算，不是人工填寫'],
    ['7 日內到期', open.filter((x) => x.due_in_7 && !x.is_overdue).length, ''],
    ['待主任核定交辦', tasks.filter((x) => x.approval_status === '待主任核定').length, '草案，尚未正式交辦'],
    ['待外部回覆', open.filter((x) => x.status === '待外部回覆').length, ''],
    ['待主管核定結案', open.filter((x) => x.status === '待主管核定').length, ''],
    ['超過 7 日未更新', stale.length, '已核定、未結案，最後異動超過 7 天'],
    ['本期新增工作', tasks.filter((x) => inPeriod(x.created_at, p)).length, ''],
    ['本期結案工作', tasks.filter((x) => inPeriod(x.closed_on, p)).length, ''],
    ['本期進度回報', (u ?? []).length, ''],
    [null, null, null],
    ['評鑑：官方標準', sum('official_count'), '附件5 逐條標準'],
    ['評鑑：已自評檢核', sum('checked_count'), ''],
    ['評鑑：佐證齊備', sum('evidence_ready_count'), ''],
    ['評鑑：自評符合', sum('conform_count'), '自評結果，不是官方評分'],
    ['評鑑：有缺口', sum('gap_count'), ''],
    ['評鑑：原文已人工複核', sum('text_reviewed_count'), ''],
    ['缺失：未結案', findings.filter((x) => x.status !== '已結案').length, ''],
    ['缺失：措施逾期', findings.reduce((n, x) => n + Number(x.overdue_action_count ?? 0), 0), ''],
    ['佐證：待審核', evidence.filter((x) => x.status === '待審核').length, ''],
    ['佐證：退回補正', evidence.filter((x) => x.status === '退回補正').length, ''],
  ];

  const taskRows: Cell[][] = [['任務ID', '工作名稱', '組別', '主責', '狀態', '主任核定', '期限', '逾期天數', '最後異動', '最新下一步', '下一步期限', '關聯指標'],
    ...tasks.filter((x) => OPEN(x) || inPeriod(x.closed_on, p))
      .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999'))
      .map((x) => [x.id, x.title, x.department_name, x.owner_name, x.status, x.approval_status, x.due_on,
        x.is_overdue && x.days_to_due !== null ? -x.days_to_due : null, x.last_activity_at ? day(new Date(x.last_activity_at)) : null,
        x.latest_next_action ?? null, x.latest_next_action_due_on ?? null, x.indicator_ids?.join('、') || null])];

  const updRows: Cell[][] = [['日期', '任務ID', '工作名稱', '回報人', '類型', '狀態變更', '下一步', '下一步期限'],
    ...(u ?? []).map((r) => [day(new Date(r.created_at)), r.task_id, title.get(r.task_id) ?? null, r.author_name, r.report_type ?? r.kind,
      r.status_from && r.status_to && r.status_from !== r.status_to ? `${r.status_from} → ${r.status_to}` : null, r.next_action, r.next_action_due_on])];

  const load = new Map<string, { open: number; overdue: number; due7: number; closed: number }>();
  for (const x of tasks) {
    const k = x.owner_name ?? '（無主責）';
    const v = load.get(k) ?? { open: 0, overdue: 0, due7: 0, closed: 0 };
    if (OPEN(x) && x.approval_status === '已核定') { v.open++; if (x.is_overdue) v.overdue++; else if (x.due_in_7) v.due7++; }
    if (inPeriod(x.closed_on, p)) v.closed++;
    load.set(k, v);
  }
  const loadRows: Cell[][] = [['主責', '進行中（已核定）', '已逾期', '7 日內到期', '本期結案'],
    ...[...load.entries()].sort((a, b) => b[1].overdue - a[1].overdue || b[1].open - a[1].open).map(([k, v]) => [k, v.open, v.overdue, v.due7, v.closed])];

  const evalRows: Cell[][] = [['指標', '名稱', '構面', '適用性', '分工核定', '主責', '官方標準', '原文已複核', '已檢核', '佐證齊備', '自評符合', '有缺口', '未結缺失', '委員評定'],
    ...(inds ?? []).map((i) => { const r = qmap.get(i.id) ?? {} as Record<string, unknown>;
      return [i.id, i.name, i.dimension_name, i.applicability_status, i.assignment_approval_status, i.owner_name,
        Number(r.official_count ?? 0), Number(r.text_reviewed_count ?? 0), Number(r.checked_count ?? 0), Number(r.evidence_ready_count ?? 0),
        Number(r.conform_count ?? 0), Number(r.gap_count ?? 0), Number(r.open_findings ?? 0), (r.official_result as string) ?? '尚未公布'] as Cell[]; })];

  const findRows: Cell[][] = [['缺失ID', '發現日', '來源', '指標', '組別', '摘要', '狀態', '措施完成', '措施逾期', '最近期限'],
    ...findings.map((x) => [x.id, x.found_on, x.source, x.indicator_id, x.department_name, x.summary, x.status,
      `${x.action_count - x.open_action_count}/${x.action_count}`, x.overdue_action_count, x.next_due_on])];

  const evRows: Cell[][] = [['佐證ID', '名稱', '年度', '存放方式', '密級', '組別', '關聯指標', '狀態', '登錄日'],
    ...evidence.map((x) => [x.id, x.title, x.year_label, x.storage_kind, x.sensitivity, x.department_name, (x.indicator_ids ?? []).join('、') || null, x.status, day(new Date(x.created_at))])];

  const info: Cell[][] = [
    ['報表', `${p.label}報（${p.from} ～ ${p.to}）`],
    ['產生時間', new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date())],
    ['產生者', who],
    ['資料範圍', '只含產生者有權限查看的資料；數字由系統即時計算'],
    ['提醒', '「自評符合」是內部自評，不是官方評鑑分數。佐證連結不在報表內，請到系統調閱。內部資料請勿外流。'],
  ];

  const sheets: Sheet[] = [
    { sheet: '摘要', data: kpi, widths: [20, 18, 44] },
    { sheet: '工作進度', data: taskRows, widths: [16, 40, 10, 10, 10, 12, 12, 8, 12, 30, 12, 14] },
    { sheet: '本期回報', data: updRows, widths: [12, 16, 36, 10, 10, 18, 30, 12] },
    { sheet: '承辦人負荷', data: loadRows, widths: [14, 16, 10, 12, 10] },
    { sheet: '評鑑檢核', data: evalRows, widths: [9, 36, 12, 12, 12, 10, 9, 10, 8, 9, 9, 8, 9, 12] },
    { sheet: '缺失改善', data: findRows, widths: [18, 12, 12, 8, 10, 44, 10, 10, 9, 12] },
    { sheet: '佐證索引', data: evRows, widths: [20, 40, 8, 12, 10, 10, 16, 10, 12] },
    { sheet: '報表資訊', data: info, widths: [12, 70] },
  ];
  return { sheets, taskCount: taskRows.length - 1 };
}
