'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { ActionForm, Submit } from '@/components/ActionForm';
import { todayTaipei } from '@/lib/format';
import { createFinding } from '../actions';

const SOURCES = ['自評檢核', '內部稽核', '主管機關查核', '評鑑委員建議', '同仁提報', '其他'];

async function NewFinding({ searchParams }: { searchParams: Promise<{ indicator?: string }> }) {
  const { indicator } = await searchParams;
  const { me, sb } = await requireMe();
  const [{ data: depts }, { data: inds }] = await Promise.all([
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    sb.from('evaluation_indicators').select('id,name').order('official_seq').order('id'),
  ]);
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/improvements" className="text-sm text-accent">← 缺失與改善</Link>
        <h1 className="h1 mt-1">提報缺失</h1>
        <p className="mt-1 text-sm text-muted">提報後通知主任與該組組長安排改善措施。只有主任、你、該組組長與評鑑統籌、措施主責看得到。</p>
      </div>
      <ActionForm action={createFinding} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="summary">缺失摘要 <span className="text-danger">*</span></label>
          <textarea id="summary" name="summary" required maxLength={500} rows={3} className="field" />
          <p className="hint">去識別化描述：不寫服務對象姓名、病歷、家庭或申訴內容。細節放在受控佐證文件。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="source">來源 <span className="text-danger">*</span></label>
            <select id="source" name="source" className="field" defaultValue={indicator ? '自評檢核' : '同仁提報'}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label" htmlFor="found_on">發現日期 <span className="text-danger">*</span></label>
            <input id="found_on" name="found_on" type="date" required max={todayTaipei()} defaultValue={todayTaipei()} className="field" /></div>
          <div><label className="label" htmlFor="indicator">關聯指標</label>
            <select id="indicator" name="indicator" className="field" defaultValue={indicator ?? ''}>
              <option value="">— 無 —</option>
              {(inds ?? []).map((i) => <option key={i.id} value={i.id}>{i.id} {i.name.slice(0, 30)}</option>)}
            </select></div>
          <div><label className="label" htmlFor="department">負責組別</label>
            <select id="department" name="department" className="field" defaultValue={me.department_id}>
              {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.id} {d.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="risk">風險</label>
            <select id="risk" name="risk" className="field" defaultValue=""><option value="">— 未評估 —</option>{['高', '中', '低'].map((r) => <option key={r}>{r}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="root_cause">可能原因</label><textarea id="root_cause" name="root_cause" rows={2} className="field" /></div>
        <Submit>送出提報</Submit>
      </ActionForm>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={NewFinding as PageLoader} title="提報缺失" />;
}
