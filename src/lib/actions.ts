import type { PostgrestError } from '@supabase/supabase-js';
import type { ActionResult } from './types';

/** 把資料庫拒絕的原因轉成給同仁看的中文（資料庫已用繁中訊息拋錯） */
export function fromError(error: PostgrestError | { message: string; hint?: string } | null, okMessage: string): ActionResult {
  if (!error) return { ok: true, message: okMessage };
  const code = 'hint' in error && error.hint && /^[A-Z_]+$/.test(error.hint) ? error.hint : undefined;
  let msg = error.message || '操作失敗';
  if (/permission denied/i.test(msg)) msg = '你沒有執行這個動作的權限';
  if (/violates check constraint "tasks_unapproved_stays_draft"/.test(msg)) msg = '尚未核定的任務不能變更為正式狀態';
  // 同一份回報在網路重送或連點時被同時送出兩次：第一次已成功寫入，這次只是重複
  if (/task_updates_client_request_id_key/.test(msg)) return { ok: true, message: '這份回報已經送出，不會重複記錄' };
  if (/duplicate key value/i.test(msg)) msg = '這筆資料已經存在，請重新整理畫面確認';
  return { ok: false, message: msg, code };
}

export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
