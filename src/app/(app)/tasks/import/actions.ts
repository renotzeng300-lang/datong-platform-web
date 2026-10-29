import { refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { parseImportFile, type ImportRow } from '@/lib/excel';

export type Issue = { row: number; field: string; message: string };
export type ImportState =
  | null
  | { stage: 'error'; message: string }
  | {
      stage: 'preview' | 'done';
      fileName: string;
      rows: ImportRow[];
      total: number;
      valid: number;
      errors: Issue[];
      warnings: Issue[];
      unknownHeaders: string[];
      createdIds: string[];
    };

const MAX_BYTES = 2 * 1024 * 1024;

type DbResult = { total: number; valid: number; errors: Issue[]; warnings: Issue[]; committed: boolean; created_ids: string[] };

/** 步驟 2：上傳 → 解析 → 交給資料庫完整檢查（不寫入） */
export async function previewImport(_: ImportState, f: FormData): Promise<ImportState> {
  const file = f.get('file');
  if (!(file instanceof File) || file.size === 0) return { stage: 'error', message: '請選擇要上傳的 Excel 檔（.xlsx）' };
  if (!/\.xlsx$/i.test(file.name)) return { stage: 'error', message: '只接受 .xlsx 檔；舊版 .xls 請先另存為 .xlsx' };
  if (file.size > MAX_BYTES) return { stage: 'error', message: '檔案超過 2MB，請分批匯入' };
  let parsed;
  try {
    parsed = await parseImportFile(await file.arrayBuffer());
  } catch (e) {
    return { stage: 'error', message: e instanceof Error ? e.message : '無法讀取檔案' };
  }
  if (!parsed.rows.length) return { stage: 'error', message: '檔案中沒有可匯入的資料列（範例列不會匯入）' };
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc('task_import_many', { p_rows: parsed.rows, p_commit: false });
  if (error) return { stage: 'error', message: error.message };
  const r = data as DbResult;
  return {
    stage: 'preview', fileName: file.name, rows: parsed.rows, total: r.total, valid: r.valid,
    errors: r.errors, warnings: r.warnings, unknownHeaders: parsed.unknownHeaders, createdIds: [],
  };
}

/** 步驟 3：確認匯入。資料庫會再完整檢查一次；任一列有錯誤就整批不寫入 */
export async function commitImport(prev: ImportState, f: FormData): Promise<ImportState> {
  if (!prev || prev.stage !== 'preview') return { stage: 'error', message: '請先上傳並預覽' };
  if (f.get('confirm') !== 'yes') return prev;
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc('task_import_many', { p_rows: prev.rows, p_commit: true });
  if (error) return { stage: 'error', message: error.message };
  const r = data as DbResult;
  if (!r.committed) return { ...prev, errors: r.errors, warnings: r.warnings, valid: r.valid };
  refresh();
  return { ...prev, stage: 'done', errors: [], warnings: r.warnings, createdIds: r.created_ids };
}

/** 頁面只用一個狀態：依按鈕決定是預覽還是確認匯入 */
export async function importStep(prev: ImportState, f: FormData): Promise<ImportState> {
  const step = f.get('step');
  if (step === 'commit') return commitImport(prev, f);
  if (step === 'reset') return null;
  return previewImport(prev, f);
}
