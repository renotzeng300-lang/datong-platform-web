'use client';
// 三種 Excel 下載（純網頁版）：一律用登入者自己的權限查詢（RLS），每次匯出寫入操作日誌。
import { downloadXlsx, headerCell } from './download';
import { getSession, hasRole } from './session';
import { IMPORT_COLUMNS } from './excel';
import { applyTaskFilters, TASK_FILTERS, type TaskSearch } from './taskFilters';
import { buildReport, periods, type Period } from './report';
import type { TaskRow } from './types';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date());
const now = () => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
function session() {
  const s = getSession();
  if (!s) throw new Error('尚未登入');
  return s;
}

/** 工作清單匯出：目前畫面的篩選結果 */
const TASK_COLUMNS: { header: string; width: number; get: (t: TaskRow) => string | number | null }[] = [
  { header: '任務ID', width: 16, get: (t) => t.id },
  { header: '工作名稱', width: 40, get: (t) => t.title },
  { header: '組別', width: 10, get: (t) => t.department_name },
  { header: '主責', width: 10, get: (t) => t.owner_name },
  { header: '協作人員', width: 18, get: (t) => t.collaborator_names },
  { header: '狀態', width: 10, get: (t) => t.status },
  { header: '主任核定', width: 10, get: (t) => t.approval_status },
  { header: '優先度', width: 8, get: (t) => t.priority },
  { header: '機密分級', width: 10, get: (t) => t.sensitivity },
  { header: '期限', width: 12, get: (t) => t.due_on },
  { header: '下次追蹤日', width: 12, get: (t) => t.next_followup_on },
  { header: '逾期天數', width: 8, get: (t) => (t.is_overdue && t.days_to_due !== null ? -t.days_to_due : null) },
  { header: '待交接', width: 8, get: (t) => (t.needs_handoff ? '是' : null) },
  { header: '關聯指標', width: 14, get: (t) => t.indicator_ids?.join('、') ?? null },
  { header: '完成日', width: 12, get: (t) => t.completed_on },
  { header: '結案日', width: 12, get: (t) => t.closed_on },
  { header: '說明', width: 40, get: (t) => t.notes },
];

export async function exportTasks(sp: TaskSearch) {
  const { me, sb } = session();
  let q = sb.from('v_tasks').select('*').order('due_on', { ascending: true, nullsFirst: false }).order('id').limit(5000);
  q = applyTaskFilters(q, sp, me);
  const { data, error } = await q;
  if (error) throw new Error(`匯出失敗：${error.message}`);
  const rows = (data ?? []) as TaskRow[];
  await sb.rpc('audit_export', { p_table: 'tasks', p_count: rows.length, p_filters: Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) });
  const info = [
    ['匯出時間', now()],
    ['匯出者', me.name],
    ['篩選', sp.filter ? (TASK_FILTERS[sp.filter] ?? sp.filter) : '全部'],
    ['其他條件', [sp.department && `組別 ${sp.department}`, sp.status && `狀態 ${sp.status}`, sp.indicator && `指標 ${sp.indicator}`, sp.q && `關鍵字「${sp.q}」`].filter(Boolean).join('、') || '無'],
    ['筆數', rows.length],
    ['提醒', '本檔只含你有權限查看的工作；內部資料請勿外流，用畢請刪除。'],
  ];
  await downloadXlsx([
    { sheet: '工作清單', data: [TASK_COLUMNS.map((c) => headerCell(c.header)), ...rows.map((t) => TASK_COLUMNS.map((c) => c.get(t)))], columns: TASK_COLUMNS.map((c) => ({ width: c.width })), stickyRowsCount: 1 },
    { sheet: '匯出資訊', data: info, columns: [{ width: 12 }, { width: 60 }] },
  ], `工作清單_${today()}.xlsx`);
  return rows.length;
}

/** 批量匯入範本：第一張「工作匯入」填資料；其餘為可填的組別、同仁、指標與允許值 */
export async function downloadImportTemplate() {
  const { me, sb } = session();
  if (!me.is_director && !hasRole(me, 'dept_lead')) throw new Error('只有主任與組長可以批量匯入');
  const [{ data: depts }, { data: people }, { data: inds }] = await Promise.all([
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    sb.rpc('assignable_people'),
    sb.from('evaluation_indicators').select('id,name').order('official_seq').order('id'),
  ]);
  const deptName = new Map((depts ?? []).map((d) => [d.id, d.name]));
  const firstDept = depts?.[0]?.id ?? 'D01';
  await downloadXlsx([
    { sheet: '工作匯入', data: [IMPORT_COLUMNS.map((c) => headerCell(c.header)),
        ['範例：整理 115 年度消防演練紀錄（這一列不會匯入，可刪除）', firstDept, '', '', '2026-11-30', '2026-11-15', '中', '一般內部', '', '']],
      columns: IMPORT_COLUMNS.map((c) => ({ width: c.width })), stickyRowsCount: 1 },
    { sheet: '填寫說明', data: [[headerCell('欄位'), headerCell('填寫方式')], ...IMPORT_COLUMNS.map((c) => [c.header, c.hint]), [],
        ['重要', '匯入的工作一律是「待主任核定」草案，不會通知任何人；主任到「決策佇列」核定後才成為正式交辦。'],
        ['重要', '任一列有錯誤，整批都不會寫入；請依預覽畫面的錯誤清單修正後重新上傳。'],
        ['重要', '留職停薪、離職或尚未確認在職的同仁，不能填為主責人或協作人員。'],
        ['上限', '一次最多 500 列。']], columns: [{ width: 14 }, { width: 80 }] },
    { sheet: '可填組別', data: [[headerCell('組別ID'), headerCell('組別名稱')], ...(depts ?? []).map((d) => [d.id, d.name])], columns: [{ width: 10 }, { width: 20 }] },
    { sheet: '可指派同仁', data: [[headerCell('人員ID'), headerCell('姓名'), headerCell('職稱'), headerCell('組別')],
        ...((people ?? []) as { id: string; name: string; title: string; department_id: string }[]).map((p) => [p.id, p.name, p.title, deptName.get(p.department_id) ?? p.department_id])],
      columns: [{ width: 10 }, { width: 12 }, { width: 14 }, { width: 12 }] },
    { sheet: '評鑑指標', data: [[headerCell('指標編號'), headerCell('指標名稱')], ...(inds ?? []).map((i) => [i.id, i.name])], columns: [{ width: 10 }, { width: 60 }] },
  ], '工作批量匯入範本.xlsx');
}

/** 週報／月報（主任、組長） */
export async function downloadReport(key: string, from?: string, to?: string) {
  const { me, sb } = session();
  if (!me.is_director && !hasRole(me, 'dept_lead')) throw new Error('只有主任與組長可以下載報表');
  let p: Period | undefined = periods().find((x) => x.key === key);
  if (key === 'custom') {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !iso.test(from) || !iso.test(to) || from > to) throw new Error('自訂期間的日期不正確（開始日不能晚於結束日）');
    p = { key, label: '自訂期間', from, to };
  }
  if (!p) throw new Error('報表期間不正確');
  const { sheets, taskCount } = await buildReport(sb, p, me.name);
  const { error } = await sb.rpc('audit_export', { p_table: 'report', p_count: taskCount, p_filters: { period: p.key, from: p.from, to: p.to } });
  if (error) throw new Error(`匯出失敗：${error.message}`);
  await downloadXlsx(sheets.map((s) => ({
    sheet: s.sheet,
    data: s.data.map((row, i) => (i === 0 && s.sheet !== '報表資訊' ? row.map((v) => headerCell(v)) : row)),
    columns: s.widths.map((width) => ({ width })),
    stickyRowsCount: s.sheet === '報表資訊' ? 0 : 1,
  })), `大同平台_${p.label}報_${p.from}_${p.to}.xlsx`);
}
