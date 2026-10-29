'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireDirector } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { ROLE_LABEL, fmtDate, fmtDateTime } from '@/lib/format';
import { confirmActive, createAccount, grantRole, resign, returnFromLeave, revokeRole, setAccountStatus, startLeave, transfer } from '../actions';

async function Person({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, sb } = await requireDirector();
  const [{ data: list }, { data: history }, { data: depts }, { data: handoffs }] = await Promise.all([
    sb.rpc('people_admin_list'),
    sb.rpc('person_history', { p_person: id }),
    sb.from('departments').select('id,name').eq('status', '啟用').order('id'),
    sb.from('handoffs').select('id, task_id, status, note, created_at').eq('from_person_id', id).order('created_at', { ascending: false }),
  ]);
  const p = (list ?? []).find((x: { id: string }) => x.id === id);
  if (!p) notFound();
  const st = p.employment_status as string;
  const self = id === me.person_id;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/people" className="text-sm text-accent">← 組織人員</Link>
        <h1 className="h1 mt-1">{p.name} <span className="text-base font-normal text-muted">{p.title}</span></h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm"><Badge>{st}</Badge><span className="text-muted">{p.id}・{p.employee_no}・{p.department_name}</span></div>
        {p.notes && <p className="mt-2 max-w-3xl text-sm text-muted">{p.notes}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {st === '待確認' && (
          <section className="card border-l-4 border-l-warn p-4">
            <h2 className="h2 mb-1">確認在職</h2>
            <p className="mb-3 text-sm text-muted">匯入資料的在職狀態為「待確認」。確認後才可被正式交辦工作。</p>
            <ActionForm action={confirmActive} className="flex gap-2"><input type="hidden" name="person" value={id} /><input name="note" placeholder="備註（選填）" className="field" aria-label="備註" /><Submit>確認在職</Submit></ActionForm>
          </section>
        )}
        {st === '留職停薪' && (
          <section className="card border-l-4 border-l-danger p-4">
            <h2 className="h2 mb-1">復職核定</h2>
            <p className="mb-3 text-sm text-muted">預計：{p.leave_expected_end_note ?? fmtDate(p.leave_expected_end_on)}。系統不會依預計日期自動復職，需填實際復職日由主任核定；角色權限另行授權。</p>
            <ActionForm action={returnFromLeave} confirm="確認核定復職？" className="grid grid-cols-2 gap-2">
              <input type="hidden" name="person" value={id} />
              <div><label className="label" htmlFor="ar">實際復職日</label><input id="ar" name="actual_return_on" type="date" required className="field" /></div>
              <div><label className="label" htmlFor="arn">備註</label><input id="arn" name="note" className="field" /></div>
              <div className="col-span-2"><Submit>核定復職</Submit></div>
            </ActionForm>
          </section>
        )}
        {(st === '在職' || st === '待確認') && !self && (
          <section className="card p-4">
            <h2 className="h2 mb-1">登記留職停薪</h2>
            <p className="mb-3 text-sm text-muted">立即暫停帳號與所有角色、移除協作；主責工作列入待交接，由主任改派（不自動改派）。</p>
            <ActionForm action={startLeave} confirm="確定登記留職停薪？" className="grid grid-cols-2 gap-2">
              <input type="hidden" name="person" value={id} />
              <div><label className="label" htmlFor="ls">留停開始日</label><input id="ls" name="started_on" type="date" required className="field" /></div>
              <div><label className="label" htmlFor="le">預計結束日（參考）</label><input id="le" name="expected_end" type="date" className="field" /></div>
              <div className="col-span-2"><label className="label" htmlFor="ln">預計日期說明／備註</label><input id="ln" name="expected_end_note" className="field" placeholder="例：預計至116年4月底，待人事核定" /></div>
              <div className="col-span-2"><Submit variant="danger">登記留停</Submit></div>
            </ActionForm>
          </section>
        )}
        <section className="card p-4">
          <h2 className="h2 mb-3">調組／職務異動</h2>
          <ActionForm action={transfer} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="person" value={id} />
            <div><label className="label" htmlFor="td">組別</label><select id="td" name="department" defaultValue={p.department_id} className="field">{(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label" htmlFor="tt">職稱</label><input id="tt" name="title" defaultValue={p.title} className="field" /></div>
            <div><label className="label" htmlFor="te">生效日</label><input id="te" name="effective" type="date" className="field" /></div>
            <div><label className="label" htmlFor="tn">備註</label><input id="tn" name="note" className="field" /></div>
            <div className="col-span-2"><Submit variant="ghost">記錄異動</Submit><p className="hint">調組時，組長與評鑑統籌權限會一併撤銷，需重新授權。</p></div>
          </ActionForm>
        </section>
        <section className="card p-4">
          <h2 className="h2 mb-3">角色授權</h2>
          <ul className="mb-3 space-y-1">{(p.roles as { id: number; role: string; department_id: string | null; source: string | null }[]).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{ROLE_LABEL[r.role]}{r.department_id ? `（${r.department_id}）` : ''} <span className="text-xs text-muted">{r.source}</span></span>
              {!(self && r.role === 'director') && (
                <ActionForm action={revokeRole} confirm="確定撤銷此授權？"><input type="hidden" name="person" value={id} /><input type="hidden" name="role_id" value={r.id} /><Submit variant="ghost">撤銷</Submit></ActionForm>
              )}
            </li>
          ))}{!p.roles.length && <li className="text-sm text-muted">目前沒有角色</li>}</ul>
          {st === '在職' && (
            <ActionForm action={grantRole} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="person" value={id} />
              <div><label className="label" htmlFor="rr">角色</label><select id="rr" name="role" className="field">
                <option value="staff">一般承辦人</option><option value="business_owner">業務負責人</option><option value="dept_lead">組長（需指定組別）</option>
                <option value="eval_coordinator">評鑑統籌（需指定組別；不含核定）</option><option value="director">主任</option></select></div>
              <div><label className="label" htmlFor="rd">範圍組別</label><select id="rd" name="department" className="field"><option value="">不限</option>{(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="label" htmlFor="rv">到期日（選填）</label><input id="rv" name="valid_to" type="date" className="field" /></div>
              <div><label className="label" htmlFor="rn">備註</label><input id="rn" name="note" className="field" /></div>
              <div className="col-span-2"><Submit variant="ghost">授權</Submit></div>
            </ActionForm>
          )}
        </section>
        <section className="card p-4">
          <h2 className="h2 mb-3">登入帳號</h2>
          {p.has_account ? (
            <div className="space-y-2 text-sm">
              <div>狀態：<Badge tone={p.account_status === '啟用' ? '在職' : '留職停薪'}>{p.account_status}</Badge></div>
              {!self && st === '在職' && (
                <ActionForm action={setAccountStatus} className="flex gap-2"><input type="hidden" name="person" value={id} />
                  <input type="hidden" name="status" value={p.account_status === '啟用' ? '暫停' : '啟用'} />
                  <input name="reason" placeholder="原因" className="field" aria-label="原因" />
                  <Submit variant="ghost">{p.account_status === '啟用' ? '暫停帳號' : '重新啟用'}</Submit></ActionForm>
              )}
            </div>
          ) : st === '留職停薪' || st === '離職' ? (
            <p className="text-sm text-muted">留職停薪或離職人員不可建立帳號。</p>
          ) : (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>到 Supabase 後台 → Authentication → Users → <b>Invite user</b>，輸入同仁本人的 Email（同仁會收到設定密碼的信）。</li>
                <li>回到這裡，輸入同一個 Email，按「連結帳號」。</li>
              </ol>
              <ActionForm action={createAccount} className="space-y-2">
                <input type="hidden" name="person" value={id} />
                <label className="label" htmlFor="em">本人 Email（個別帳號，不可共用）</label>
                <input id="em" name="email" type="email" required className="field" />
                <Submit>連結帳號</Submit>
              </ActionForm>
            </div>
          )}
        </section>
        {st !== '離職' && !self && (
          <details className="card p-4">
            <summary className="cursor-pointer text-sm text-danger">登記離職</summary>
            <ActionForm action={resign} confirm="確定登記離職？歷史紀錄會保留。" className="mt-3 grid grid-cols-2 gap-2">
              <input type="hidden" name="person" value={id} />
              <div><label className="label" htmlFor="lo">離職日</label><input id="lo" name="left_on" type="date" required className="field" /></div>
              <div><label className="label" htmlFor="lon">備註</label><input id="lon" name="note" className="field" /></div>
              <div className="col-span-2"><Submit variant="danger">登記離職</Submit></div>
            </ActionForm>
          </details>
        )}
      </div>

      {!!handoffs?.length && (
        <section className="card p-4">
          <h2 className="h2 mb-2">交接清單</h2>
          <ul className="space-y-1 text-sm">{handoffs.map((h) => (
            <li key={h.id}><Badge tone={h.status === '待交接' ? '留職停薪' : '已核定'}>{h.status}</Badge> {h.task_id ? <Link href={`/tasks/item?id=${encodeURIComponent(h.task_id)}`} className="text-accent hover:underline">{h.task_id}</Link> : null} <span className="text-muted">{h.note}</span></li>
          ))}</ul>
        </section>
      )}

      <section className="card p-4">
        <h2 className="h2 mb-3">異動歷程（不可修改）</h2>
        <ol className="space-y-2 text-sm">{(history ?? []).map((h: { id: number; change_type: string; effective_on: string; from_status: string | null; to_status: string | null; from_department: string | null; to_department: string | null; note: string | null; executed_at: string; approved_by: string | null }) => (
          <li key={h.id} className="border-l-2 border-line pl-3">
            <div><b>{h.change_type}</b>　生效 {fmtDate(h.effective_on)}{h.from_status && h.to_status && h.from_status !== h.to_status && <>　{h.from_status} → {h.to_status}</>}{h.from_department && h.to_department && h.from_department !== h.to_department && <>　{h.from_department} → {h.to_department}</>}</div>
            <div className="text-xs text-muted">{fmtDateTime(h.executed_at)}・核定 {h.approved_by ?? '系統'}{h.note && `・${h.note}`}</div>
          </li>
        ))}</ol>
      </section>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Person as PageLoader} title="人員" />;
}
