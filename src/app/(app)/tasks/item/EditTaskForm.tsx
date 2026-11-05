'use client';
import { useState, useTransition } from 'react';
import { editTaskFields } from '../actions';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import type { ActionResult } from '@/lib/types';

type Person = { id: string; name: string; title: string | null; department_id: string };
type Dept = { id: string; name: string };
type Values = {
  title: string; notes: string; department: string; owner: string; collaborators: string[]; due_on: string;
  next_followup_on: string; priority: string; sensitivity: string; indicators: string; deliverables: string; cross_support: string;
};

const splitList = (s: string) => [...new Set(s.split(/[、，,;；\s/／]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))].sort();
const sameList = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/**
 * 修改工作內容（收合在「工作內容」卡片裡）：所有欄位都可以改。
 * 只把有改的欄位送給資料庫；誰能改、主責／協作是否在職、正式交辦必須有主責等，都由資料庫 task_edit 檢查。
 */
export function EditTaskForm({ task, formal, isManager, people, depts }: {
  task: {
    id: string; title: string; notes: string | null; department_id: string; owner_person_id: string | null; collaborators: string[];
    due_on: string | null; next_followup_on: string | null; priority: string; sensitivity: string; indicator_ids: string[];
    deliverables: string | null; cross_support: string | null; updated_at: string;
  };
  formal: boolean; isManager: boolean; people: Person[]; depts: Dept[];
}) {
  const init: Values = {
    title: task.title, notes: task.notes ?? '', department: task.department_id, owner: task.owner_person_id ?? '',
    collaborators: task.collaborators, due_on: task.due_on ?? '', next_followup_on: task.next_followup_on ?? '',
    priority: task.priority, sensitivity: task.sensitivity, indicators: task.indicator_ids.join('、'),
    deliverables: task.deliverables ?? '', cross_support: task.cross_support ?? '',
  };
  const [v, setV] = useState<Values>(init);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Values>(k: K, val: Values[K]) => { setV((o) => ({ ...o, [k]: val })); setResult(null); };

  const changes: Record<string, unknown> = {};
  for (const k of ['title', 'notes', 'department', 'owner', 'due_on', 'next_followup_on', 'priority', 'sensitivity', 'deliverables', 'cross_support'] as const) {
    if (v[k].trim() !== String(init[k]).trim()) changes[k] = v[k].trim() || null;
  }
  if (!sameList(v.collaborators, init.collaborators)) changes.collaborators = v.collaborators;
  if (!sameList(splitList(v.indicators), task.indicator_ids)) changes.indicators = splitList(v.indicators);
  const dirty = Object.keys(changes).length > 0;
  useUnsavedGuard(dirty && !result?.ok);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const notifyDirector = formal && !isManager && ('due_on' in changes || 'owner' in changes);
  const byDept = depts.map((d) => ({ d, list: people.filter((p) => p.department_id === d.id) })).filter((g) => g.list.length);
  // 目前的主責／協作若已不在可選名單（例如留停），仍顯示出來，讓同仁知道要改
  const missing = [task.owner_person_id, ...task.collaborators].filter((id): id is string => !!id && !people.some((p) => p.id === id));

  return (
    <details className="mt-4 rounded-lg border border-line" data-edit-task>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-accent">✏️ 修改工作內容</summary>
      <form
        className="space-y-3 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          if (!dirty) { setResult({ ok: false, message: '內容沒有變更' }); return; }
          start(async () => { setResult(await editTaskFields(task.id, changes, reason, task.updated_at)); });
        }}
      >
        <p className="text-xs text-muted">
          {formal ? '所有欄位都可以修改，儲存後立即生效。' : '主任核定前都可以修改；主任核定時看到的就是最新內容。'}
          修改會記錄在「進度與核定歷程」。
        </p>
        <fieldset disabled={pending} className="space-y-3">
          <div><label className="label" htmlFor="ed-title">工作名稱</label>
            <input id="ed-title" value={v.title} onChange={(e) => set('title', e.target.value)} required minLength={2} maxLength={300} className="field" /></div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="ed-dept">組別</label>
              <select id="ed-dept" value={v.department} onChange={(e) => set('department', e.target.value)} className="field">
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className="label" htmlFor="ed-owner">{formal ? '主責人' : '建議主責'}</label>
              <select id="ed-owner" value={v.owner} onChange={(e) => set('owner', e.target.value)} className="field">
                <option value="">{formal ? '— 請選擇 —' : '（留空，由主任核定時指定）'}</option>
                {missing.includes(v.owner) && <option value={v.owner}>{nameOf(v.owner)}（目前不可指派）</option>}
                {byDept.map(({ d, list }) => (
                  <optgroup key={d.id} label={d.name}>{list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.title ? `｜${p.title}` : ''}</option>)}</optgroup>
                ))}
              </select></div>
            <div><label className="label" htmlFor="ed-prio">優先度</label>
              <select id="ed-prio" value={v.priority} onChange={(e) => set('priority', e.target.value)} className="field">
                {['緊急', '高', '中', '低'].map((p) => <option key={p}>{p}</option>)}
              </select></div>
            <div><label className="label" htmlFor="ed-due">{formal ? '期限' : '建議期限'}</label>
              <input id="ed-due" type="date" value={v.due_on} onChange={(e) => set('due_on', e.target.value)} className="field" /></div>
            <div><label className="label" htmlFor="ed-follow">下次追蹤日</label>
              <input id="ed-follow" type="date" value={v.next_followup_on} onChange={(e) => set('next_followup_on', e.target.value)} className="field" /></div>
            <div><label className="label" htmlFor="ed-sens">機密分級</label>
              <select id="ed-sens" value={v.sensitivity} onChange={(e) => set('sensitivity', e.target.value)} className="field">
                {['一般內部', '限組別', '高度限制'].map((p) => <option key={p}>{p}</option>)}
              </select></div>
          </div>

          <fieldset>
            <legend className="label">協作人員 <span className="font-normal text-muted">（已選 {v.collaborators.length} 位）</span></legend>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-line p-2 text-sm">
              {missing.filter((id) => v.collaborators.includes(id)).map((id) => (
                <label key={id} className="mr-3 inline-flex min-h-9 items-center gap-1.5 text-danger">
                  <input type="checkbox" checked onChange={() => set('collaborators', v.collaborators.filter((x) => x !== id))} />{nameOf(id)}（目前不可指派，請取消）
                </label>
              ))}
              {byDept.map(({ d, list }) => (
                <div key={d.id}>
                  <div className="text-xs text-muted">{d.name}</div>
                  {list.filter((p) => p.id !== v.owner).map((p) => (
                    <label key={p.id} className="mr-3 inline-flex min-h-9 items-center gap-1.5">
                      <input type="checkbox" checked={v.collaborators.includes(p.id)}
                             onChange={(e) => set('collaborators', e.target.checked ? [...v.collaborators, p.id] : v.collaborators.filter((x) => x !== p.id))} />
                      {p.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          <div><label className="label" htmlFor="ed-ind">關聯評鑑指標</label>
            <input id="ed-ind" value={v.indicators} onChange={(e) => set('indicators', e.target.value)} className="field" placeholder="指標編號，多個用「、」分隔，例 4101、4302-A" /></div>
          <div><label className="label" htmlFor="ed-notes">說明</label>
            <textarea id="ed-notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} rows={4} className="field" /></div>
          <div><label className="label" htmlFor="ed-deliv">應備佐證／成果</label>
            <textarea id="ed-deliv" value={v.deliverables} onChange={(e) => set('deliverables', e.target.value)} maxLength={2000} rows={2} className="field" /></div>
          <div><label className="label" htmlFor="ed-cross">跨組協作／專業支援</label>
            <textarea id="ed-cross" value={v.cross_support} onChange={(e) => set('cross_support', e.target.value)} maxLength={2000} rows={2} className="field" /></div>
          {formal && (
            <div><label className="label" htmlFor="ed-reason">修改原因（選填）</label>
              <input id="ed-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="field" placeholder="例如：配合活動日期調整" /></div>
          )}
          {notifyDirector && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">你修改了期限或主責人：儲存後立即生效，並會通知主任。</p>}
          <button type="submit" className="btn-primary min-h-11">{pending ? '儲存中…' : '儲存修改'}</button>
        </fieldset>
        {result && (
          <p role={result.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>
            {result.message}{!result.ok && '（已填內容仍保留）'}
          </p>
        )}
      </form>
    </details>
  );
}
