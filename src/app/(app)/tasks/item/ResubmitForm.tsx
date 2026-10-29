'use client';
import { startTransition, useActionState, useEffect, useState, useTransition } from 'react';
import { refreshAndWait } from '@/lib/session';
import { getReportState, resubmitTask } from '../actions';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import type { ActionResult } from '@/lib/types';

/**
 * 被退回的提報：修改後重新提報。
 * - 受控欄位：失敗、畫面過期復原時保留輸入；資料庫會重新驗證身分、狀態與版本。
 * - 畫面過期（STALE）：先確認目前狀態；仍是「退回」才重新載入，否則說明原因並提供複製，不自動重送。
 */
export function ResubmitForm({ taskId, title, due, notes, updatedAt, today }: {
  taskId: string; title: string; due: string | null; notes: string | null; updatedAt: string; today: string;
}) {
  const initial = { note: '', title, due: due ?? '', notes: notes ?? '' };
  const [v, setV] = useState(initial);
  const [state, action, pending] = useActionState<ActionResult, FormData>(resubmitTask, null);
  const [shown, setShown] = useState<ActionResult>(null);
  const [lock, setLock] = useState('');
  const [reloaded, setReloaded] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const dirty = !state?.ok && (v.note !== '' || v.title !== initial.title || v.due !== initial.due || v.notes !== initial.notes);
  useUnsavedGuard(dirty);
  useEffect(() => { setShown(state); }, [state]);

  if (state?.ok) return <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p>;
  const stale = shown && !shown.ok && shown.code === 'STALE';

  async function recover() {
    const r = await getReportState(taskId);
    if (!r.viewable) { setLock('你目前無法再查看這項工作（權限可能已變更），因此不會重新送出。'); return; }
    if (r.approvalStatus !== '退回') { setLock(`這項工作已不是「退回」狀態（目前：${r.approvalStatus}），不需要重新提報。`); return; }
    setShown(null);
    setReloaded(true);
    startRefresh(async () => { await refreshAndWait(); });
  }

  if (lock) {
    const text = `【修改後重新提報】\n修改說明：${v.note}\n工作名稱：${v.title}\n建議期限：${v.due}\n說明：${v.notes}`;
    return (
      <div className="space-y-2" data-unsent>
        <p role="alert" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{lock}</p>
        <label className="label" htmlFor="rs-copy">尚未送出的內容</label>
        <textarea id="rs-copy" readOnly value={text} rows={5} className="field font-mono text-xs" />
        <button type="button" className="btn-ghost min-h-11" onClick={() => navigator.clipboard?.writeText(text)}>複製內容</button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || refreshing) return;
        const fd = new FormData();
        fd.set('id', taskId);
        fd.set('expected_updated_at', updatedAt);
        for (const [k, val] of Object.entries(v)) if (val) fd.set(k, val);
        setShown(null);
        startTransition(() => action(fd));
      }}
    >
      {refreshing && <p role="status" className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">正在載入最新資料…</p>}
      {reloaded && !refreshing && <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm">已載入最新資料，你的輸入都還在，請確認後再送出。</p>}
      <fieldset disabled={pending || refreshing} className="space-y-3">
        <div>
          <label className="label" htmlFor="rs-note">這次修改或補充了什麼 <span className="text-danger">*</span></label>
          <textarea id="rs-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} required minLength={2} maxLength={1000} rows={2} className="field" placeholder="針對退回原因說明修改內容" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div><label className="label" htmlFor="rs-title">工作名稱</label><input id="rs-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} minLength={2} maxLength={300} className="field" /></div>
          <div><label className="label" htmlFor="rs-due">建議期限</label><input id="rs-due" type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} min={today} className="field" /></div>
        </div>
        <div><label className="label" htmlFor="rs-notes">說明</label><textarea id="rs-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={2} className="field" /></div>
        <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto">{pending ? '送出中…' : '重新提報給主任核定'}</button>
      </fieldset>
      {shown && !shown.ok && !stale && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{shown.message}（已填內容仍保留）</p>}
      {stale && (
        <div role="alert" className="space-y-2 rounded-lg bg-warn-soft px-3 py-3 text-sm text-warn">
          <p><b>這項工作剛被其他人更新</b>，這次沒有送出。重新載入最新資料後，你填的內容會保留，確認後再送出。</p>
          <button type="button" onClick={recover} className="btn-primary min-h-11">保留輸入並載入最新資料</button>
        </div>
      )}
    </form>
  );
}
