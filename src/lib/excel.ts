// 工作批量匯入／匯出的 Excel 工具：欄位定義、範本、解析上傳檔
import readXlsxFile from 'read-excel-file/universal';

/** 匯入欄位：表頭文字（* 為必填）→ 傳給資料庫的欄位名稱 */
export const IMPORT_COLUMNS = [
  { header: '工作名稱*', key: 'title', width: 40, hint: '必填，2～300 字；勿寫服務對象姓名、病歷等可識別資料' },
  { header: '組別*', key: 'department', width: 12, hint: '必填，填組別ID（如 D01）或組別名稱' },
  { header: '主責人', key: 'owner', width: 12, hint: '選填，填人員ID、員工編號或姓名；只能填在職同仁' },
  { header: '協作人員', key: 'collaborators', width: 20, hint: '選填，多人用「、」分隔' },
  { header: '期限', key: 'due_on', width: 12, hint: '選填，2026-11-30 或 115/11/30' },
  { header: '下次追蹤日', key: 'next_followup_on', width: 12, hint: '選填，日期格式同上' },
  { header: '優先度', key: 'priority', width: 8, hint: '緊急／高／中／低，空白為「中」' },
  { header: '機密分級', key: 'sensitivity', width: 10, hint: '一般內部／限組別／高度限制，空白為「一般內部」' },
  { header: '關聯指標', key: 'indicators', width: 14, hint: '選填，評鑑指標編號，多個用「、」分隔' },
  { header: '說明', key: 'notes', width: 40, hint: '選填，最多 2000 字' },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]['key'];
export type ImportRow = { row_no: number } & Partial<Record<ImportKey, string>>;

const normHeader = (h: unknown) => String(h ?? '').replace(/[*＊\s（）()]/g, '').replace(/^必填/, '');
const HEADER_MAP = new Map<string, ImportKey>(IMPORT_COLUMNS.map((c) => [normHeader(c.header), c.key]));
// 也接受匯出檔的欄名，方便「匯出 → 修改 → 匯入新工作」
HEADER_MAP.set('主責', 'owner');
HEADER_MAP.set('期限日', 'due_on');
HEADER_MAP.set('追蹤日', 'next_followup_on');
HEADER_MAP.set('指標', 'indicators');

const pad = (n: number) => String(n).padStart(2, '0');

/** 各種日期寫法 → YYYY-MM-DD；認不出來就原樣傳給資料庫，由資料庫回報錯誤 */
export function normDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // 未設日期格式的 Excel 序號
    const d = new Date(Math.round((v - 25569) * 864e5));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2,4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})\s*日?$/);
  if (m) {
    let y = Number(m[1]);
    if (y < 1911) y += 1911; // 民國年
    return `${y}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  }
  return s;
}

const text = (v: unknown) => {
  if (v === null || v === undefined) return undefined;
  const s = (v instanceof Date ? (normDate(v) ?? "") : String(v)).trim();
  return s === '' ? undefined : s;
};

/** 解析上傳的 .xlsx：優先讀「工作匯入」工作表，否則讀第一張 */
export async function parseImportFile(buf: Blob | ArrayBuffer): Promise<{ rows: ImportRow[]; unknownHeaders: string[]; sheet: string }> {
  const all = (await readXlsxFile(buf)) as unknown as Array<{ sheet: string; data: unknown[][] }>;
  const target = all.find((s) => s.sheet === '工作匯入') ?? all[0];
  if (!target) throw new Error('檔案裡沒有工作表');
  // 找表頭列：前 5 列中第一個含「工作名稱」的列
  const headerIdx = target.data.slice(0, 5).findIndex((r) => r.some((c) => normHeader(c) === '工作名稱'));
  if (headerIdx < 0) throw new Error('找不到「工作名稱」欄位，請使用系統提供的範本');
  const headers = target.data[headerIdx].map((h) => HEADER_MAP.get(normHeader(h)));
  const unknownHeaders = target.data[headerIdx]
    .filter((h, i) => h !== null && h !== undefined && String(h).trim() !== '' && !headers[i])
    .map((h) => String(h));
  const rows: ImportRow[] = [];
  target.data.slice(headerIdx + 1).forEach((r, i) => {
    const row: ImportRow = { row_no: headerIdx + 2 + i };
    let any = false;
    headers.forEach((k, ci) => {
      if (!k) return;
      const raw = r[ci];
      const v = k === 'due_on' || k === 'next_followup_on' ? normDate(raw) : text(raw);
      if (v !== undefined) { row[k] = v; any = true; }
    });
    // 範本裡的示範列（以「範例：」開頭）不匯入
    if (any && !String(row.title ?? '').startsWith('範例：')) rows.push(row);
  });
  return { rows, unknownHeaders, sheet: target.sheet };
}
