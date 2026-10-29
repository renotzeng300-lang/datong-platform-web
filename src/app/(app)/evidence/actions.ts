import { go, refresh as reload } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { fromError, str } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

/** 指標代碼可用空白、逗號、頓號分隔，例如「4206、6101」 */
const indicatorList = (raw: string | null) =>
  raw ? [...new Set(raw.split(/[\s,，、;；]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))] : [];

const refresh = (_doc?: string | null, _indicators: string[] = []) => reload();

export async function registerEvidence(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const indicators = indicatorList(str(f, 'indicators'));
  const { data, error } = await sb.rpc('evidence_register', {
    p_title: str(f, 'title'), p_sensitivity: str(f, 'sensitivity'), p_storage_kind: str(f, 'storage_kind'),
    p_url: str(f, 'url'), p_location: str(f, 'location'), p_share_confirmed: f.get('share_confirmed') === 'on',
    p_year: str(f, 'year'), p_doc_type: str(f, 'doc_type'), p_version: str(f, 'version'),
    p_indicators: indicators.length ? indicators : null, p_task: str(f, 'task'), p_department: str(f, 'department'),
  });
  if (error) return fromError(error, '');
  refresh(data.id, indicators);
  go(`/evidence/item?id=${encodeURIComponent(data.id)}`);
  return null;
}

export async function updateStorage(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const { error } = await sb.rpc('evidence_update_storage', {
    p_doc: id, p_storage_kind: str(f, 'storage_kind'), p_url: str(f, 'url'), p_location: str(f, 'location'),
    p_share_confirmed: f.get('share_confirmed') === 'on', p_version: str(f, 'version'),
  });
  refresh(id);
  return fromError(error, '已更新存放位置，狀態回到「待審核」');
}

export async function linkIndicator(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const ind = (str(f, 'indicator') ?? '').toUpperCase();
  const { error } = await sb.rpc('evidence_link_indicator', { p_doc: id, p_indicator: ind || null });
  refresh(id, ind ? [ind] : []);
  return fromError(error, `已關聯指標 ${ind}`);
}

export async function reviewEvidence(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const status = str(f, 'status');
  const { error } = await sb.rpc('evidence_review', { p_doc: id, p_status: status, p_note: str(f, 'note') });
  refresh(id);
  return fromError(error, `審核結果：${status}`);
}

export async function grantAccess(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const { error } = await sb.rpc('evidence_grant', { p_doc: id, p_person: str(f, 'person') });
  refresh(id);
  return fromError(error, '已授權調閱');
}

export async function revokeAccess(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const { error } = await sb.rpc('evidence_revoke', { p_doc: id, p_person: str(f, 'person') });
  refresh(id);
  return fromError(error, '已撤銷調閱授權');
}

/** 調閱：每次都由資料庫留紀錄。Google 連結直接開啟；實體存放位置顯示在畫面上（不放進網址） */
export async function openEvidence(_: ActionResult, f: FormData): Promise<ActionResult> {
  const sb = supabaseBrowser();
  const id = str(f, 'doc');
  const { data, error } = await sb.rpc('evidence_open', { p_doc: id, p_action: '檢視連結' });
  if (error) return fromError(error, '');
  refresh();
  const v = String(data ?? '');
  if (/^https:\/\/(drive|docs)\.google\.com\//.test(v)) { window.location.assign(v); return { ok: true, message: '正在開啟 Google 雲端檔案…' }; }
  return { ok: true, message: v ? `存放位置：${v}` : '這份佐證尚未登錄存放位置' };
}
