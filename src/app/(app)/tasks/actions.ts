import { go, refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

// 每個動作都只是呼叫資料庫 RPC；授權、留停、核定規則全部在資料庫內檢查。

export async function createTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc('task_create', {
    p_title: str(f, 'title'), p_department: str(f, 'department'), p_owner: str(f, 'owner'), p_due: str(f, 'due'),
    p_priority: str(f, 'priority') ?? '中', p_sensitivity: str(f, 'sensitivity') ?? '一般內部',
    p_next_followup: str(f, 'next_followup'), p_collaborators: f.getAll('collaborators').map(String).filter(Boolean),
    p_notes: str(f, 'notes'), p_indicator: str(f, 'indicator'),
  });
  if (error) return fromError(error, '');
  refresh();
  go(`/tasks/item?id=${encodeURIComponent(data.id)}&created=1`);
  return null;
}

export async function approveTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const decision = str(f, 'decision')!;
  const { error } = await sb.rpc('task_approve', { p_task: id, p_decision: decision, p_note: str(f, 'note'), p_owner: str(f, 'owner'), p_due: str(f, 'due') });
  refresh();
  if (error) return fromError(error, '');
  // 核定後草案區塊會消失，改以頁面提示告知結果
  go(`/tasks/item?id=${encodeURIComponent(id)}&decided=${decision === '核定' ? 'approved' : 'returned'}`);
  return null;
}

export async function approveMany(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const ids = f.getAll('ids').map(String);
  if (!ids.length) return { ok: false, message: '請先勾選要核定的工作' };
  const { data, error } = await sb.rpc('task_approve_batch', { p_tasks: ids, p_note: str(f, 'note') });
  refresh();
  if (error) return fromError(error, '');
  const r = data as { approved: string[]; failed: { id: string; message: string }[] };
  if (!r.failed.length) return { ok: true, message: `已核定 ${r.approved.length} 筆交辦` };
  return {
    ok: r.approved.length > 0,
    message: `已核定 ${r.approved.length} 筆；${r.failed.length} 筆未核定：` + r.failed.map((x) => `${x.id}（${x.message}）`).join('；'),
  };
}

export async function assignTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_assign', {
    p_task: id, p_owner: str(f, 'owner'), p_collaborators: f.getAll('collaborators').map(String).filter(Boolean), p_reason: str(f, 'reason'),
  });
  refresh();
  return fromError(error, '已更新主責與協作人員');
}

export async function changeDue(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_change_due', { p_task: id, p_new_due: str(f, 'due'), p_reason: str(f, 'reason') });
  refresh();
  return fromError(error, '已送出（主管變更立即生效；其他人為申請，待主管核定）');
}

export async function closeTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const decision = str(f, 'decision')!;
  const { error } = await sb.rpc('task_close', { p_task: id, p_decision: decision, p_note: str(f, 'note') });
  refresh();
  return fromError(error, decision === '核定' ? '已正式結案' : '已退回承辦人');
}

export async function cancelTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_cancel', { p_task: id, p_reason: str(f, 'reason') });
  refresh();
  return fromError(error, '已取消');
}

export async function nudgeTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_nudge', { p_task: id, p_message: str(f, 'message') });
  refresh();
  return fromError(error, '已提醒主責人');
}

export async function proposeToDirector(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('submit_proposal', { p_entity_type: 'task', p_entity_id: id, p_reason: str(f, 'reason') });
  refresh();
  return fromError(error, '已提報主任');
}

export async function resolveDecision(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const result = str(f, 'result');
  const { error } = await sb.rpc('decision_resolve', { p_decision_id: Number(str(f, 'decision_id')), p_result: result, p_note: str(f, 'note') });
  refresh();
  const tid = str(f, 'task_id');
  if (tid) refresh();
  return fromError(error, result === '核定' ? '已核定' : '已退回');
}

export async function annotateDecision(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('decision_annotate', {
    p_decision_id: Number(str(f, 'decision_id')), p_proposal: str(f, 'proposal'), p_impact: str(f, 'impact'),
  });
  refresh();
  return fromError(error, '已補充說明');
}

/** 調整風險分類與嚴重程度（主任／該組組長，理由必填，寫入異動紀錄） */
export async function setRisk(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_set_risk', {
    p_task: id, p_category: str(f, 'category'), p_severity: str(f, 'severity'), p_reason: str(f, 'reason'),
  });
  refresh();
  return fromError(error, '已更新風險評估');
}

/** 三種回報（回報進度／需要協助／申請結案）共用；資料庫 task_submit_report 依類型檢查 */
export async function submitReport(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const type = str(f, 'type');
  const keys = ['status', 'accomplishment', 'next_action', 'next_action_due', 'next_followup', 'blocker', 'support_request',
    'support_type', 'support_needed_by', 'result_link', 'evidence_note'];
  const payload: Record<string, string | boolean> = {};
  for (const k of keys) { const v = str(f, k); if (v) payload[k] = v; }
  payload.stalled = f.get('stalled') === 'true';
  payload.acceptance_confirmed = f.get('acceptance_confirmed') === 'true';
  const { error } = await sb.rpc('task_submit_report', {
    p_task: id, p_type: type, p_payload: payload,
    p_client_request_id: str(f, 'client_request_id'), p_expected_updated_at: str(f, 'expected_updated_at'),
  });
  // 失敗時不重新整理頁面：畫面維持同仁看到的版本，由同仁按「保留輸入並載入最新資料」自行確認
  if (error) return fromError(error, '');
  refresh();
  return {
    ok: true,
    message: type === '申請結案' ? '已申請結案，等候主管核定。歷程已更新。'
      : type === '需要協助' ? (str(f, 'support_type') === '主任決策' ? '已送出，已進入主任的決策佇列。' : '已送出協助需求。')
      : '進度已回報，歷程已更新。',
  };
}

/** 被退回的提報：修改後重新提報（仍需主任核定） */
export async function resubmitTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'id')!;
  const { error } = await sb.rpc('task_resubmit', {
    p_task: id, p_note: str(f, 'note'), p_title: str(f, 'title'), p_due: str(f, 'due'), p_notes: str(f, 'notes'),
    p_expected_updated_at: str(f, 'expected_updated_at'),
  });
  if (error) return fromError(error, '');    // 失敗不重新整理頁面，保留同仁的輸入與畫面
  refresh();
  return fromError(null, '已重新提報，等候主任核定。核定前不算正式交辦。');
}

/**
 * 過期畫面復原用：只讀取「這項工作目前還看不看得到、狀態與版本」，不寫入任何資料。
 * 看不到（被移出、權限變更）時回 viewable:false，畫面就不重新載入，以免同仁的輸入隨頁面消失。
 */
export async function getReportState(id: string): Promise<{ viewable: boolean; status?: string; approvalStatus?: string; updatedAt?: string }> {
  const sb = supabaseBrowser();
  const { data } = await sb.from('v_tasks').select('status, approval_status, updated_at').eq('id', id)
    .maybeSingle<{ status: string; approval_status: string; updated_at: string }>();
  if (!data) return { viewable: false };
  return { viewable: true, status: data.status, approvalStatus: data.approval_status, updatedAt: data.updated_at };
}
