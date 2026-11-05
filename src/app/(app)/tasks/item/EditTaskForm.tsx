'use client';
import { ActionForm, Submit } from '@/components/ActionForm';
import { editTask } from '../actions';

/**
 * 修改工作內容（收合在「工作內容」卡片裡）。
 * mode：draft＝提報人修改自己待核定的草案（名稱、說明、優先度、建議期限）
 *       manager＝主任／組長（名稱、說明、優先度；正式期限走「變更期限」）
 *       owner＝主責人（只能改說明）
 */
export function EditTaskForm({ mode, taskId, title, notes, priority, due, updatedAt, today }: {
  mode: 'draft' | 'manager' | 'owner'; taskId: string; title: string; notes: string | null; priority: string;
  due: string | null; updatedAt: string; today: string;
}) {
  const hint = mode === 'draft' ? '主任核定前都可以修改；主任核定時看到的就是最新內容。'
    : mode === 'owner' ? '主責人可以修改「說明」。工作名稱、優先度請找主任或組長修改；期限請用「申請變更期限」。'
    : '正式期限請用右側「變更期限」，以保留原期限與核定紀錄。';
  return (
    <details className="mt-4 rounded-lg border border-line" data-edit-task>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-accent">✏️ 修改工作內容{mode === 'owner' ? '（說明）' : ''}</summary>
      <ActionForm action={editTask} className="space-y-3 border-t border-line p-3">
        <input type="hidden" name="id" value={taskId} />
        <input type="hidden" name="expected_updated_at" value={updatedAt} />
        <p className="text-xs text-muted">{hint}修改會記錄在「進度與核定歷程」。</p>
        {mode !== 'owner' && (
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div><label className="label" htmlFor="ed-title">工作名稱</label>
              <input id="ed-title" name="title" defaultValue={title} required minLength={2} maxLength={300} className="field" /></div>
            <div><label className="label" htmlFor="ed-prio">優先度</label>
              <select id="ed-prio" name="priority" defaultValue={priority} className="field">
                {['緊急', '高', '中', '低'].map((p) => <option key={p}>{p}</option>)}
              </select></div>
          </div>
        )}
        {mode === 'draft' && (
          <div className="sm:w-48"><label className="label" htmlFor="ed-due">建議期限</label>
            <input id="ed-due" name="due" type="date" defaultValue={due ?? ''} min={today} className="field" /></div>
        )}
        <div><label className="label" htmlFor="ed-notes">說明</label>
          <textarea id="ed-notes" name="notes" defaultValue={notes ?? ''} maxLength={2000} rows={4} className="field" /></div>
        {mode !== 'draft' && (
          <div><label className="label" htmlFor="ed-reason">修改原因（選填）</label>
            <input id="ed-reason" name="reason" maxLength={200} className="field" placeholder="例如：補充細節、修正錯字" /></div>
        )}
        <Submit>儲存修改</Submit>
      </ActionForm>
    </details>
  );
}
