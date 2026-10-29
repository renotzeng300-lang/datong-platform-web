'use client';
/** 查詢失敗時的畫面：不顯示技術細節，提供重試 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card max-w-xl space-y-3 p-6">
      <h1 className="h2 text-danger">資料暫時無法載入</h1>
      <p className="text-sm text-muted">可能是網路或資料庫連線短暫中斷。請按「重試」；若持續發生，請通知系統管理者。</p>
      <button type="button" onClick={reset} className="btn-primary">重試</button>
    </div>
  );
}
