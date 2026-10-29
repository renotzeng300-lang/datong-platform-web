'use client';
// 在瀏覽器產生 Excel 並下載（純網頁版：取代原本的伺服器下載網址）
import writeExcelFile from 'write-excel-file/universal';

type Cell = string | number | boolean | Date | null | undefined | { value: unknown; [k: string]: unknown };
export type XlsxSheet = { sheet: string; data: Cell[][]; columns?: { width: number }[]; stickyRowsCount?: number };

export async function downloadXlsx(sheets: XlsxSheet[], fileName: string) {
  // write-excel-file 的型別較嚴格；這裡統一把 null 視為空白
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await writeExcelFile(sheets as any).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const headerCell = (v: unknown) => ({ value: v ?? '', fontWeight: 'bold' as const, backgroundColor: '#E8EEF4' });
