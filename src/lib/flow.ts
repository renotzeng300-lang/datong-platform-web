// 流程狀態對照：把資料庫的「任務狀態＋核定狀態＋待處理申請」翻成同仁看得懂的一句話與下一步。
// 只做「顯示」，不另建狀態；所有判斷都以資料庫欄位為準。
import type { TaskRow } from './types';

export type DecisionLite = {
  id: number; kind: string; decision: string; requested_by: string | null; requested_at: string;
  decided_by: string | null; decided_at: string | null; reason: string | null;
  before_value: Record<string, string> | null; after_value: Record<string, string> | null;
  parent_decision_id?: number | null;
};

export type MyRole = '主責' | '協作' | '統籌' | '主管' | '主任' | '提報人' | null;

export type Flow = {
  label: string;
  tone: 'hold' | 'warn' | 'danger' | 'ok' | 'accent' | 'muted';
  nextStep: string;       // 狀態標籤旁的下一步說明
  waitingFor?: string;    // 目前等待誰
};

/** 核定者寫的意見（reason 可能是「申請理由｜核定意見：…」） */
export function decisionNote(reason: string | null | undefined): string {
  if (!reason) return '';
  const i = reason.indexOf('核定意見：');
  return i >= 0 ? reason.slice(i + 5) : reason;
}

const latest = (ds: DecisionLite[], kind: string) =>
  ds.filter((d) => d.kind === kind).sort((a, b) => b.id - a.id)[0];

export function deriveFlow(t: TaskRow, decisions: DecisionLite[], role: MyRole): Flow {
  const approver = '主任' + (t.department_id && t.department_id !== 'D03' ? '或組長' : '');
  if (t.status === '已取消') return { label: '已取消', tone: 'muted', nextStep: '此工作已取消，不需處理' };
  if (t.status === '已結案') return { label: '已結案', tone: 'ok', nextStep: '已核定結案；可查看成果與歷程' };
  if (t.approval_status === '退回') {
    return {
      label: '提報被退回', tone: 'danger',
      nextStep: role === '主責' || role === '提報人' ? '依退回原因修改後重新提報' : '等待提報人修改後重新提報',
    };
  }
  if (t.approval_status === '待主任核定') {
    return { label: '交辦待核定', tone: 'hold', nextStep: '尚未正式交辦，核定前不需執行', waitingFor: approver };
  }
  if (t.status === '待主管核定') {
    return { label: '結案待核定', tone: 'warn', nextStep: '已申請結案，等候核定；暫時不需再回報', waitingFor: approver };
  }
  const lastClose = latest(decisions, '結案核定');
  if (lastClose?.decision === '退回') {
    return {
      label: '結案被退回', tone: 'danger',
      nextStep: role === '主責' || role === '主管' || role === '主任' ? '依退回原因補件，再申請結案' : '主責補件中，可協助補齊資料',
    };
  }
  const dueReq = decisions.find((d) => d.kind === '期限變更' && d.decision === '待核定');
  if (dueReq) {
    return { label: '期限變更待核定', tone: 'warn', nextStep: '核定前原期限仍有效，請照原期限進行', waitingFor: approver };
  }
  if (t.status === '受阻') return { label: '受阻', tone: 'danger', nextStep: '已申請協助；有進展請回報進度' };
  if (t.status === '待外部回覆') return { label: '待外部回覆', tone: 'warn', nextStep: '依下次追蹤日追蹤外部回覆' };
  if (t.status === '待處理') return { label: '待處理', tone: 'accent', nextStep: role === '主責' ? '尚未開始：回報第一次進度' : '等待主責開始執行' };
  return { label: t.status, tone: 'accent', nextStep: role === '主責' ? '持續回報進度；完成後申請結案' : '協助主責完成' };
}

export function roleOf(t: TaskRow, me: { person_id: string; is_director: boolean; roles: { role: string; department_id: string | null }[] },
  collaboratorIds: string[]): MyRole {
  if (t.owner_person_id === me.person_id) return '主責';
  if (collaboratorIds.includes(me.person_id)) return '協作';
  if (me.is_director) return '主任';
  if (me.roles.some((r) => r.role === 'dept_lead' && (!r.department_id || r.department_id === t.department_id))) return '主管';
  if (t.coordinator_person_id === me.person_id) return '統籌';
  return null;
}

export const FLOW_TONE: Record<Flow['tone'], string> = {
  hold: 'border-l-hold bg-hold-soft/40',
  warn: 'border-l-warn bg-warn-soft/50',
  danger: 'border-l-danger bg-danger-soft/50',
  ok: 'border-l-ok bg-ok-soft/50',
  accent: 'border-l-accent bg-accent-soft/40',
  muted: 'border-l-line bg-paper',
};
