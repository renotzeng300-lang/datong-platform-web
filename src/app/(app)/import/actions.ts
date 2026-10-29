import { refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

export async function commitImport(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc('import_commit', { p_batch: Number(str(f, 'batch')) });
  refresh();
  if (error) return fromError(error, '');
  return { ok: true, message: `已匯入：人員 ${data.people}、指標 ${data.indicators}、分工 ${data.assignments}（待主任核定）、教保任務 ${data.tasks_from_v5}（全部待主任核定）、年度盤點 ${data.year_reviews}。` };
}
