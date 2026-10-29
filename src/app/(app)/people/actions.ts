import { refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const done = (pid: string | null) => { refresh(); };

export async function confirmActive(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('person_confirm_active', { p_person: pid, p_note: str(f, 'note') });
  done(pid); return fromError(error, '已確認在職，現在可以被指派工作');
}
export async function startLeave(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('person_start_leave', { p_person: pid, p_started_on: str(f, 'started_on'), p_expected_end: str(f, 'expected_end'), p_expected_end_note: str(f, 'expected_end_note'), p_note: str(f, 'note') });
  done(pid); return fromError(error, '已登記留職停薪：權限與帳號已暫停、協作已移除，主責工作列入待交接');
}
export async function returnFromLeave(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('person_return_from_leave', { p_person: pid, p_actual_return_on: str(f, 'actual_return_on'), p_note: str(f, 'note') });
  done(pid); return fromError(error, '已核定復職。角色權限沒有自動恢復，請視需要重新授權');
}
export async function resign(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('person_resign', { p_person: pid, p_left_on: str(f, 'left_on'), p_note: str(f, 'note') });
  done(pid); return fromError(error, '已登記離職；歷史紀錄保留，主責工作列入待交接');
}
export async function transfer(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('person_transfer', { p_person: pid, p_department: str(f, 'department'), p_title: str(f, 'title'), p_effective: str(f, 'effective'), p_note: str(f, 'note') });
  done(pid); return fromError(error, '已記錄異動');
}
export async function grantRole(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('role_grant', { p_person: pid, p_role: str(f, 'role'), p_department: str(f, 'department'), p_valid_to: str(f, 'valid_to'), p_note: str(f, 'note') });
  done(pid); return fromError(error, '已授權');
}
export async function revokeRole(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('role_revoke', { p_role_id: Number(str(f, 'role_id')), p_reason: str(f, 'reason') ?? '主任撤銷' });
  done(pid); return fromError(error, '已撤銷');
}
export async function createPerson(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('person_create', {
    p_id: str(f, 'id'), p_employee_no: str(f, 'employee_no'), p_name: str(f, 'name'), p_title: str(f, 'title'),
    p_department: str(f, 'department'), p_employment_type: str(f, 'employment_type') ?? '全職', p_hired_on: str(f, 'hired_on'),
    p_confirm_active: f.get('confirm_active') === 'on', p_note: str(f, 'note'),
  });
  done(null); return fromError(error, '已新增人員');
}
export async function createDepartment(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const { error } = await sb.rpc('department_create', { p_id: str(f, 'id'), p_name: str(f, 'name'), p_note: str(f, 'note') });
  done(null); return fromError(error, '已新增組別');
}
export async function setAccountStatus(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser(); const pid = str(f, 'person');
  const { error } = await sb.rpc('account_set_status', { p_person: pid, p_status: str(f, 'status'), p_reason: str(f, 'reason') });
  done(pid); return fromError(error, '已更新帳號狀態');
}

/**
 * 連結登入帳號（純網頁版，比照經費平台）：
 * 主任先在 Supabase 後台 Authentication → Users → Invite user 邀請同仁的 Email（同仁自行設定密碼），
 * 再在這裡輸入同一個 Email，把登入帳號連結到人員資料。網站不持有任何管理金鑰。
 */
export async function createAccount(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const pid = str(f, 'person');
  const email = str(f, 'email');
  if (!pid || !email) return { ok: false, message: '請填寫 Email' };
  const { error } = await sb.rpc('account_link_by_email', { p_email: email, p_person: pid });
  if (!error) refresh();
  return fromError(error, `已把 ${email} 的登入帳號連結到這位同仁。同仁用邀請信設定密碼後即可登入。`);
}
