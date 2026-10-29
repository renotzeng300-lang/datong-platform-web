// 主任儀表板四區塊：定義與型別（數字與明細都來自資料庫 director_board，同一個函式）
export const BLOCKS = [
  { key: 'intervene', label: '今天必須介入', tone: 'danger', empty: '今天沒有需要立即介入的工作。',
    rule: '已逾期且嚴重度高；服務安全類逾期或受阻；法定期限 3 日內到期或已逾期；受阻且等待主任決策；外部回覆已過追蹤日。' },
  { key: 'decision', label: '等待主任決策', tone: 'hold', empty: '目前沒有等待你決策的申請。',
    rule: '決策佇列中你有權處理的申請（交辦、結案、期限變更、協調事項、提案），依風險與等待天數排序。' },
  { key: 'delay', label: '本週可能延誤', tone: 'warn', empty: '本週沒有看起來會延誤的工作。',
    rule: '7 日內到期，且：7 日以上未更新、下一步預計晚於期限、受阻或等待外部回覆。' },
  { key: 'support', label: '需要督導或跨組協助', tone: 'accent', empty: '目前沒有申請協助或待交接的工作。',
    rule: '最新回報申請協助、待交接（原主責留停或離職）、14 日以上未更新。' },
] as const;

export type BlockKey = (typeof BLOCKS)[number]['key'];

export type BoardItem = {
  block: BlockKey; item_key: string; task_id: string | null; decision_id: number | null; title: string;
  department_name: string | null; owner_name: string | null; status: string | null; due_on: string | null;
  days_to_due: number | null; risk_category: string | null; risk_severity: string | null; risk_rank: number;
  waiting_days: number | null; reasons: string[];
};

/** 區塊內排序：風險高者優先，其次等待久／期限近 */
export function sortItems(items: BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) =>
    b.risk_rank - a.risk_rank
    || (b.waiting_days ?? -1) - (a.waiting_days ?? -1)
    || (a.days_to_due ?? 9999) - (b.days_to_due ?? 9999)
    || a.item_key.localeCompare(b.item_key));
}
