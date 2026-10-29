import { go, refresh as reload } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const refresh = (_indicator?: string | null) => reload();

export async function decideAssignment(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'indicator')!;
  const { error } = await sb.rpc('eval_assignment_decide', { p_indicator: id, p_decision: str(f, 'decision'), p_note: str(f, 'note') });
  refresh(id);
  return fromError(error, '已記錄分工核定');
}

/** 逐條檢核：佐證狀態與符合狀態分開記錄 */
export async function recordCheck(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('criterion_check_record', {
    p_criterion: str(f, 'criterion'), p_evidence_status: str(f, 'evidence_status'), p_conformity: str(f, 'conformity'),
    p_gap: str(f, 'gap'), p_evidence_ref: str(f, 'evidence_ref'), p_document: null, p_note: str(f, 'note'),
  });
  refresh(str(f, 'indicator'));
  return fromError(error, '已記錄檢核，等待主任複核');
}

export async function reviewCheck(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const result = str(f, 'result');
  const { error } = await sb.rpc('criterion_check_review', { p_check: Number(str(f, 'check')), p_result: result, p_note: str(f, 'note') });
  refresh(str(f, 'indicator'));
  return fromError(error, result === '退回' ? '已退回這筆檢核' : '已複核');
}

export async function markTextReviewed(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('criterion_mark_reviewed', { p_criterion: str(f, 'criterion'), p_note: str(f, 'note') });
  refresh(str(f, 'indicator'));
  return fromError(error, '已標記：原文已對照 PDF 人工複核');
}

export async function proposeRevision(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('criterion_propose_revision', { p_criterion: str(f, 'criterion'), p_new_text: str(f, 'text'), p_reason: str(f, 'reason') });
  refresh(str(f, 'indicator'));
  refresh();
  return fromError(error, '已送出修訂建議，主任核定前原文不會變動');
}

export async function setApplicability(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'indicator');
  const { error } = await sb.rpc('indicator_set_applicability', {
    p_indicator: id, p_status: str(f, 'status'), p_basis: str(f, 'basis'), p_basis_date: str(f, 'basis_date'), p_note: str(f, 'note'),
  });
  refresh(id);
  return fromError(error, '已更新適用性並留下紀錄');
}

export async function updateYearReview(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('year_review_update', {
    p_review: str(f, 'review'), p_exists: str(f, 'exists'), p_complete: str(f, 'complete'), p_verifiable: str(f, 'verifiable'),
    p_document: null, p_improvement: str(f, 'improvement'),
  });
  refresh(str(f, 'indicator'));
  return fromError(error, '已更新年度盤點');
}

export async function recordOfficialResult(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'indicator');
  const { error } = await sb.rpc('official_result_record', {
    p_indicator: id, p_result: str(f, 'result') ?? '', p_source_doc: str(f, 'source_doc') ?? '', p_source_date: str(f, 'source_date'), p_note: str(f, 'note'),
  });
  refresh(id);
  return fromError(error, '已登錄委員評定結果');
}
