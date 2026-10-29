// 通知的「目前處理狀態」：通知本身是歷史事件（內容不改寫），目前狀態一律由現有的申請紀錄（decisions）
// 與任務狀態即時推導，不另存欄位，避免與實際資料不同步。已讀（read_at）與處理狀態彼此獨立。

export type NotifyLite = { kind: string; title: string; created_at: string; entity_type: string | null; entity_id: string | null };
export type NotifyTask = { status: string; approval_status: string } | null;   // null＝目前看不到（RLS）
export type NotifyDecision = {
  id: number; kind: string; decision: string; requested_by: string | null; requested_at: string;
  decided_at: string | null; parent_decision_id: number | null;
};
export type NotifyState = {
  label: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  open: boolean;            // 是否仍需要收件人採取行動
  cta?: string;             // 需要行動時的按鈕文字
};

const SAME_EVENT_MS = 10_000;   // 通知與決策在同一交易寫入，時間相同；保留些許容差
const closedLabel = (s: string) => (s === '已結案' ? '工作已結案' : '工作已取消');

/** 找出這則通知對應的「退回」決策，以及之後依它重新送審的下一筆 */
function chainAfterReturn(n: NotifyLite, ds: NotifyDecision[], kind: string) {
  // 通知與退回決策在同一交易寫入（時間相同）；取時間最接近的那一筆，容差內才算
  const at = Date.parse(n.created_at);
  const ret = ds.filter((d) => d.kind === kind && d.decision === '退回' && d.decided_at
                        && Math.abs(Date.parse(d.decided_at) - at) <= SAME_EVENT_MS)
    .sort((a, b) => Math.abs(Date.parse(a.decided_at!) - at) - Math.abs(Date.parse(b.decided_at!) - at) || b.id - a.id)[0];
  const next = ret ? ds.filter((d) => d.parent_decision_id === ret.id).sort((a, b) => b.id - a.id)[0] : undefined;
  return { ret, next };
}

export function deriveNotifyState(n: NotifyLite, task: NotifyTask, ds: NotifyDecision[]): NotifyState | null {
  if (n.entity_type !== 'task' || !n.entity_id) return null;
  if (!task) return { label: '目前無法查看這項工作（權限可能已變更）', tone: 'muted', open: false };
  const closed = task.status === '已結案' || task.status === '已取消';

  // 結案申請被退回 → 是否已補件重新送審
  if (n.kind === '結案結果' && n.title.includes('退回')) {
    const { next } = chainAfterReturn(n, ds, '結案核定');
    if (next?.decision === '待核定') return { label: '已補件重新送審，等候核定', tone: 'ok', open: false };
    if (next?.decision === '核定') return { label: '補件後已核定結案', tone: 'ok', open: false };
    if (next?.decision === '退回') return { label: '重新送審後再次被退回，請看較新的通知', tone: 'muted', open: false };
    if (closed) return { label: closedLabel(task.status), tone: 'muted', open: false };
    if (task.status === '待主管核定') return { label: '已重新送審，等候核定', tone: 'ok', open: false };
    return { label: '尚未補件：請依退回原因補件後重新申請結案', tone: 'danger', open: true, cta: '前往補件' };
  }

  // 提報（交辦草案）被退回 → 是否已修改後重新提報
  if (n.kind === '核定退回') {
    const { next } = chainAfterReturn(n, ds, '交辦核定');
    if (next?.decision === '待核定') return { label: '已修改後重新提報，等候主任核定', tone: 'ok', open: false };
    if (next?.decision === '核定') return { label: '重新提報後已核定交辦', tone: 'ok', open: false };
    if (next?.decision === '退回') return { label: '重新提報後再次被退回，請看較新的通知', tone: 'muted', open: false };
    if (closed) return { label: closedLabel(task.status), tone: 'muted', open: false };
    if (task.approval_status === '待主任核定') return { label: '已重新提報，等候主任核定', tone: 'ok', open: false };
    if (task.approval_status === '已核定' || task.approval_status === '免核定') return { label: '已核定交辦', tone: 'ok', open: false };
    return { label: '尚未重新提報：請依退回原因修改', tone: 'danger', open: true, cta: '前往修改' };
  }

  // 給主任的待辦：是否仍有待處理的申請
  const pendingKind = n.kind === '重新提報' ? '交辦核定' : n.kind === '協調事項' ? '協調事項' : null;
  if (pendingKind) {
    if (ds.some((d) => d.kind === pendingKind && d.decision === '待核定')) return { label: '待你處理', tone: 'warn', open: true, cta: '前往處理' };
    return { label: '已處理', tone: 'ok', open: false };
  }

  if (n.kind === '結案結果') return { label: closed ? closedLabel(task.status) : `目前：${task.status}`, tone: closed ? 'ok' : 'muted', open: false };
  if (closed) return { label: closedLabel(task.status), tone: 'muted', open: false };
  return { label: `目前：${task.approval_status === '已核定' || task.approval_status === '免核定' ? task.status : task.approval_status}`, tone: 'muted', open: false };
}
