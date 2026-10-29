'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { importStep, type ImportState, type Issue } from './actions';

function Btn({ step, children, variant = 'primary', disabled }: { step: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="step" value={step} disabled={pending || disabled} className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}>
      {pending ? '處理中…' : children}
    </button>
  );
}

function IssueTable({ items, tone }: { items: Issue[]; tone: 'danger' | 'warn' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper"><tr><th className="th w-20">Excel 列</th><th className="th w-28">欄位</th><th className="th">說明</th></tr></thead>
        <tbody className="divide-y divide-line">
          {items.map((i, k) => (
            <tr key={k}><td className="td tabular-nums">第 {i.row} 列</td><td className="td">{i.field}</td>
              <td className={`td ${tone === 'danger' ? 'text-danger' : ''}`}>{i.message}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportFlow({ isDirector }: { isDirector: boolean }) {
  const [state, action] = useActionState<ImportState, FormData>(importStep, null);

  if (state && state.stage === 'done') {
    return (
      <section className="card space-y-3 p-5" role="status">
        <h2 className="text-lg font-semibold text-ok">已匯入 {state.createdIds.length} 項工作（待主任核定草案）</h2>
        <p className="text-sm text-muted">來源檔案：{state.fileName}。匯入動作已寫入操作日誌；草案在核定前不會通知承辦人。</p>
        <div className="flex flex-wrap gap-2">
          {isDirector
            ? <Link href="/approvals?kind=交辦核定" className="btn-primary">前往決策佇列，批次核定</Link>
            : <Link href="/tasks?filter=awaiting_approval" className="btn-primary">查看待主任核定的工作</Link>}
          <form action={action}><Btn step="reset" variant="ghost">再匯入一批</Btn></form>
        </div>
      </section>
    );
  }

  const preview = state && state.stage === 'preview' ? state : null;
  const hasErrors = !!preview && preview.errors.length > 0;

  return (
    <div className="space-y-4">
      <form action={action} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="grow">
          <label className="label" htmlFor="file">上傳填好的 Excel（.xlsx，2MB 以內，最多 500 列）</label>
          <input id="file" name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="field" />
        </div>
        <Btn step="preview">上傳並檢查</Btn>
      </form>

      {state?.stage === 'error' && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">{state.message}</p>}

      {preview && (
        <section className="space-y-4">
          <div className={`card p-4 ${hasErrors ? 'border-danger' : ''}`}>
            <p className="font-medium">
              {preview.fileName}：共 {preview.total} 列，
              {hasErrors
                ? <span className="text-danger">發現 {preview.errors.length} 個錯誤，整批暫不匯入。請修正 Excel 後重新上傳。</span>
                : <span className="text-ok">全部 {preview.valid} 列檢查通過。</span>}
            </p>
            {preview.unknownHeaders.length > 0 && (
              <p className="mt-1 text-sm text-muted">以下欄位不在範本中，已略過：{preview.unknownHeaders.join('、')}</p>
            )}
          </div>

          {hasErrors && (
            <div className="card p-4"><h2 className="mb-2 font-semibold text-danger">錯誤（必須修正）</h2><IssueTable items={preview.errors} tone="danger" /></div>
          )}
          {preview.warnings.length > 0 && (
            <div className="card p-4"><h2 className="mb-2 font-semibold">提醒（不影響匯入，請確認）</h2><IssueTable items={preview.warnings} tone="warn" /></div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper"><tr>
                <th className="th">列</th><th className="th">工作名稱</th><th className="th">組別</th><th className="th">主責</th>
                <th className="th">協作</th><th className="th">期限</th><th className="th">追蹤日</th><th className="th">優先</th><th className="th">指標</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {preview.rows.slice(0, 200).map((r) => {
                  const bad = preview.errors.some((e) => e.row === r.row_no);
                  return (
                    <tr key={r.row_no} className={bad ? 'bg-danger-soft/40' : ''}>
                      <td className="td tabular-nums">{r.row_no}</td><td className="td max-w-xs">{r.title}</td><td className="td">{r.department}</td>
                      <td className="td">{r.owner ?? <span className="text-muted">未指定</span>}</td><td className="td">{r.collaborators}</td>
                      <td className="td whitespace-nowrap">{r.due_on}</td><td className="td whitespace-nowrap">{r.next_followup_on}</td>
                      <td className="td">{r.priority ?? '中'}</td><td className="td">{r.indicators}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.rows.length > 200 && <p className="p-3 text-sm text-muted">僅顯示前 200 列，確認匯入時會處理全部 {preview.rows.length} 列。</p>}
          </div>

          {!hasErrors && (
            <form action={action} className="card flex flex-wrap items-center gap-3 p-4"
                  onSubmit={(e) => { if (!window.confirm(`確定匯入 ${preview.valid} 項工作？匯入後為「待主任核定」草案。`)) e.preventDefault(); }}>
              <input type="hidden" name="confirm" value="yes" />
              <Btn step="commit">確認匯入 {preview.valid} 項（待主任核定）</Btn>
              <span className="text-sm text-muted">匯入後不會通知任何人，核定後才成為正式交辦。</span>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
