import { go, refresh as reload } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const refresh = (_finding?: string | null, _indicator?: string | null) => reload();

export async function createFinding(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const indicator = str(f, 'indicator');
  const { data, error } = await sb.rpc('finding_create', {
    p_source: str(f, 'source'), p_summary: str(f, 'summary'), p_found_on: str(f, 'found_on'),
    p_indicator: indicator, p_department: str(f, 'department'), p_risk: str(f, 'risk'), p_root_cause: str(f, 'root_cause'),
  });
  if (error) return fromError(error, '');
  refresh(data.id, indicator);
  go(`/improvements/item?id=${encodeURIComponent(data.id)}`);
  return null;
}

export async function addAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'finding');
  const { error } = await sb.rpc('improvement_action_add', {
    p_finding: id, p_action: str(f, 'action'), p_owner: str(f, 'owner'), p_due: str(f, 'due'), p_task: str(f, 'task'),
  });
  refresh(id, str(f, 'indicator'));
  return fromError(error, '已新增改善措施並通知主責');
}

export async function markActionDone(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'finding');
  const { error } = await sb.rpc('improvement_action_done', { p_action: Number(str(f, 'action')), p_note: str(f, 'note') });
  refresh(id, str(f, 'indicator'));
  return fromError(error, '已回報完成');
}

export async function reviewEffectiveness(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'finding');
  const result = str(f, 'result');
  const { error } = await sb.rpc('effectiveness_review_record', { p_finding: id, p_result: result, p_note: str(f, 'note') });
  refresh(id, str(f, 'indicator'));
  return fromError(error, result === '有效' ? '成效確認有效，缺失已結案' : '已記錄複核結果，請再安排改善措施');
}
