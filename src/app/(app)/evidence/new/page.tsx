'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { ActionForm, Submit } from '@/components/ActionForm';
import { StorageFields } from '@/components/StorageFields';
import { registerEvidence } from '../actions';

async function NewEvidence({ searchParams }: { searchParams: Promise<{ indicator?: string; task?: string }> }) {
  const { indicator, task } = await searchParams;
  const { me, sb } = await requireMe();
  const { data: depts } = await sb.from('departments').select('id,name').eq('status', '啟用').order('id');
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/evidence" className="text-sm text-accent">← 佐證索引</Link>
        <h1 className="h1 mt-1">登錄佐證</h1>
        <p className="mt-1 text-sm text-muted">平台只記錄佐證的名稱、年度、關聯指標與存放位置，不存放檔案本身。登錄後由主任審核。</p>
      </div>
      <ActionForm action={registerEvidence} className="card space-y-5 p-5">
        {task && <input type="hidden" name="task" value={task} />}
        <div>
          <label className="label" htmlFor="title">佐證名稱 <span className="text-danger">*</span></label>
          <input id="title" name="title" required maxLength={120} className="field" placeholder="例：115年度消防設備檢修申報" />
          <p className="hint">名稱不要寫服務對象姓名或病況。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div><label className="label" htmlFor="year">年度</label>
            <input id="year" name="year" className="field" placeholder="例：115" maxLength={20} /></div>
          <div><label className="label" htmlFor="doc_type">文件類型</label>
            <input id="doc_type" name="doc_type" className="field" placeholder="例：會議紀錄、申報書" maxLength={30} /></div>
          <div><label className="label" htmlFor="version">版本</label>
            <input id="version" name="version" className="field" placeholder="例：v1、核定版" maxLength={30} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="indicators">關聯指標</label>
            <input id="indicators" name="indicators" className="field" defaultValue={indicator ?? ''} placeholder="例：4206、6101" />
            <p className="hint">可填多個指標代碼，用頓號或空白分隔。關聯不代表標準已符合，仍需逐條檢核。</p>
          </div>
          <div>
            <label className="label" htmlFor="department">所屬組別</label>
            {me.is_director ? (
              <select id="department" name="department" className="field" defaultValue={me.department_id}>
                {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.id} {d.name}</option>)}
              </select>
            ) : (
              <>
                <input type="hidden" name="department" value={me.department_id} />
                <p id="department" className="field bg-paper">{(depts ?? []).find((d) => d.id === me.department_id)?.name ?? me.department_id}</p>
              </>
            )}
          </div>
        </div>
        <StorageFields idPrefix="new" />
        <Submit>登錄佐證</Submit>
      </ActionForm>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={NewEvidence as PageLoader} title="登錄佐證" />;
}
