/** 頁面載入中（儀表板、明細等伺服器查詢期間） */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" data-loading className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-line" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-32 animate-pulse bg-paper" />)}
      </div>
      <span className="sr-only">載入中…</span>
      <p className="text-sm text-muted">資料載入中…</p>
    </div>
  );
}
