'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe, hasRole } from '@/lib/session';
import { ActionForm, Submit } from '@/components/ActionForm';
import { createTask } from '../actions';

async function NewTask() {
  const { me, sb } = await requireMe();
  const canManage = me.is_director || hasRole(me, 'dept_lead');
  const [{ data: depts }, { data: people }, { data: inds }] = await Promise.all([
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    sb.rpc('assignable_people'),
    sb.from('evaluation_indicators').select('id,name').order('official_seq').order('id'),
  ]);
  const list = (people ?? []) as { id: string; name: string; title: string; department_id: string }[];
  const owners = list.length ? list : [{ id: me.person_id, name: `${me.name}（我）`, title: me.title ?? '', department_id: me.department_id }];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/tasks" className="text-sm text-accent">← 工作管理</Link>
        <h1 className="h1 mt-1">{canManage ? '新增工作' : '提報工作'}</h1>
        <p className="mt-1 text-sm text-muted">
          {me.is_director
            ? '主任建立並指定主責人，即視為核定交辦，系統會通知主責與協作人員。'
            : canManage
              ? '組長可直接交辦一般組內工作；需主任核定的案件會進入「待主任核定」。'
              : '提報後會進入「待主任核定」，核定前不算正式交辦，也不會通知承辦人。'}
        </p>
      </div>
      <ActionForm action={createTask} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">工作名稱 <span className="text-danger">*</span></label>
          <input id="title" name="title" required minLength={2} maxLength={300} className="field" />
          <p className="hint">請勿寫入服務對象姓名、病歷、申訴內容等可識別資料。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="department">組別 <span className="text-danger">*</span></label>
            <select id="department" name="department" required defaultValue={me.department_id} className="field">
              {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.id} {d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="owner">主責人（唯一）</label>
            <select id="owner" name="owner" className="field" defaultValue="">
              <option value="">— 暫不指定 —</option>
              {owners.map((p) => <option key={p.id} value={p.id}>{p.name}｜{p.title}</option>)}
            </select>
            <p className="hint">清單只列「在職」同仁；留職停薪、離職與待確認者不會出現。</p>
          </div>
          <div><label className="label" htmlFor="due">期限</label><input id="due" name="due" type="date" className="field" /></div>
          <div><label className="label" htmlFor="next_followup">下次追蹤日</label><input id="next_followup" name="next_followup" type="date" className="field" /></div>
          <div>
            <label className="label" htmlFor="priority">優先度</label>
            <select id="priority" name="priority" defaultValue="中" className="field">{['緊急', '高', '中', '低'].map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="sensitivity">機密分級</label>
            <select id="sensitivity" name="sensitivity" defaultValue="一般內部" className="field">
              <option>一般內部</option><option>限組別</option><option>高度限制</option>
            </select>
            <p className="hint">高度限制：只有主任、主責與協作人員看得到。</p>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="indicator">關聯評鑑指標（選填）</label>
            <select id="indicator" name="indicator" className="field" defaultValue="">
              <option value="">— 不關聯 —</option>
              {(inds ?? []).map((i) => <option key={i.id} value={i.id}>{i.id} {i.name}</option>)}
            </select>
          </div>
        </div>
        {list.length > 0 && (
          <fieldset>
            <legend className="label">協作人員（可複選）</legend>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
              {list.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm">
                  <input type="checkbox" name="collaborators" value={p.id} /> {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div><label className="label" htmlFor="notes">說明</label><textarea id="notes" name="notes" rows={3} className="field" /></div>
        <div className="flex gap-2"><Submit>{canManage ? '建立' : '送出提報'}</Submit><Link href="/tasks" className="btn-ghost">取消</Link></div>
      </ActionForm>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={NewTask as PageLoader} title="新增工作" />;
}
