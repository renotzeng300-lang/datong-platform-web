'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { ROLE_LABEL, fmtDate } from '@/lib/format';
import { createDepartment, createPerson } from './actions';

type Admin = { id: string; employee_no: string; name: string; title: string; department_id: string; department_name: string; employment_status: string; leave_expected_end_on: string | null; leave_expected_end_note: string | null; account_status: string | null; has_account: boolean; roles: { role: string; department_id: string | null }[]; open_tasks: number; pending_handoffs: number };

async function People() {
  const { me, sb } = await requireMe();
  const { data: depts } = await sb.from('departments').select('id,name,status,note').order('id');
  if (!me.is_director) {
    const { data } = await sb.from('people').select('id,name,title,department_id,employment_status').order('department_id').order('id');
    return (
      <div className="space-y-5">
        <h1 className="h1">同仁名錄</h1>
        <p className="text-sm text-muted">只顯示同組同仁與主任。人事資料由主任管理。</p>
        <ul className="card divide-y divide-line">{(data ?? []).map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-2.5"><span>{p.name}<span className="ml-2 text-sm text-muted">{p.title}</span></span><span className="text-sm text-muted">{(depts ?? []).find((d) => d.id === p.department_id)?.name}</span></li>
        ))}</ul>
      </div>
    );
  }
  const { data } = await sb.rpc('people_admin_list');
  const people = (data ?? []) as Admin[];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">組織人員</h1>
        <p className="text-sm text-muted">「待確認」人員在主任確認在職前不會出現在指派選單；留職停薪人員不能被指派、核定或收到通知，預計復職日到了也不會自動恢復。</p>
      </header>
      {(depts ?? []).map((d) => (
        <section key={d.id} className="card overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="h2">{d.id} {d.name} {d.status !== '啟用' && <Badge>{d.status}</Badge>}</h2>
            {d.note && <p className="text-xs text-muted max-w-2xl">{d.note}</p>}
          </div>
          <table className="w-full">
            <thead className="bg-paper"><tr><th className="th">姓名</th><th className="th">職稱</th><th className="th">在職狀態</th><th className="th">角色</th><th className="th">帳號</th><th className="th text-right">未結工作</th><th className="th text-right">待交接</th></tr></thead>
            <tbody className="divide-y divide-line">
              {people.filter((p) => p.department_id === d.id).map((p) => (
                <tr key={p.id}>
                  <td className="td"><Link href={`/people/item?id=${encodeURIComponent(p.id)}`} className="font-medium hover:underline">{p.name}</Link><div className="text-xs text-muted">{p.id}・{p.employee_no}</div></td>
                  <td className="td">{p.title}</td>
                  <td className="td"><Badge>{p.employment_status}</Badge>{p.employment_status === '留職停薪' && <div className="text-xs text-muted">預計 {p.leave_expected_end_note ?? fmtDate(p.leave_expected_end_on)}（不自動復職）</div>}</td>
                  <td className="td text-sm">{p.roles.map((r) => ROLE_LABEL[r.role] + (r.department_id ? `·${r.department_id}` : '')).join('、') || '—'}</td>
                  <td className="td text-sm">{p.has_account ? <Badge tone={p.account_status === '啟用' ? '在職' : '留職停薪'}>{p.account_status}</Badge> : <span className="text-muted">未建立</span>}</td>
                  <td className="td text-right tabular-nums">{p.open_tasks}</td>
                  <td className={`td text-right tabular-nums ${p.pending_handoffs ? 'font-semibold text-danger' : ''}`}>{p.pending_handoffs || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="h2 mb-3">新增人員</h2>
          <ActionForm action={createPerson} resetOnSuccess className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="pid">人員ID（永續，不可變）</label><input id="pid" name="id" required pattern="P[0-9]{4,}" placeholder="P0050" className="field" /></div>
            <div><label className="label" htmlFor="eno">員工編號</label><input id="eno" name="employee_no" required className="field" /></div>
            <div><label className="label" htmlFor="pname">姓名</label><input id="pname" name="name" required className="field" /></div>
            <div><label className="label" htmlFor="ptitle">職稱</label><input id="ptitle" name="title" className="field" /></div>
            <div><label className="label" htmlFor="pdept">組別</label><select id="pdept" name="department" className="field">{(depts ?? []).filter((d) => d.status === '啟用').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label" htmlFor="ptype">聘用型態</label><select id="ptype" name="employment_type" className="field"><option>全職</option><option>兼職</option></select></div>
            <div><label className="label" htmlFor="phired">到職日</label><input id="phired" name="hired_on" type="date" className="field" /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="confirm_active" />已確認在職（可立即指派）</label>
            <div className="col-span-2"><Submit>新增</Submit></div>
          </ActionForm>
        </section>
        <section className="card p-5">
          <h2 className="h2 mb-3">新增組別</h2>
          <ActionForm action={createDepartment} resetOnSuccess className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="did">組別代碼</label><input id="did" name="id" required pattern="D[0-9]{2,}" placeholder="D04" className="field" /></div>
            <div><label className="label" htmlFor="dname">名稱</label><input id="dname" name="name" required className="field" /></div>
            <div className="col-span-2"><label className="label" htmlFor="dnote">備註</label><input id="dnote" name="note" className="field" /></div>
            <div className="col-span-2"><Submit>新增組別</Submit></div>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={People as PageLoader} title="組織人員" />;
}
