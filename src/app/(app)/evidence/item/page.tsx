'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { notFound } from '@/lib/session';
import { requireMe } from '@/lib/session';
import { Badge } from '@/components/Badge';
import { ActionForm, Submit } from '@/components/ActionForm';
import { StorageFields } from '@/components/StorageFields';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { EVIDENCE_DRIVE_ACCOUNT } from '@/lib/org';
import { grantAccess, linkIndicator, openEvidence, reviewEvidence, revokeAccess, updateStorage } from '../actions';

async function EvidenceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, sb } = await requireMe();
  const { data: e } = await sb.from('v_evidence').select('*').eq('id', id).maybeSingle();
  if (!e) notFound();
  const canManage = me.is_director || e.uploaded_by === me.person_id;
  const [{ data: inds }, { data: grants }, { data: logs }, { data: people }] = await Promise.all([
    e.indicator_ids.length
      ? sb.from('evaluation_indicators').select('id,name').in('id', e.indicator_ids).order('id')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    canManage
      ? sb.from('evidence_access_grants').select('person_id,granted_at,revoked_at').eq('document_id', id).is('revoked_at', null).order('granted_at')
      : Promise.resolve({ data: [] as { person_id: string; granted_at: string }[] }),
    me.is_director
      ? sb.from('evidence_access_logs').select('person_id,action,at').eq('document_id', id).order('at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as { person_id: string; action: string; at: string }[] }),
    canManage
      ? sb.from('people').select('id,name').eq('employment_status', '在職').order('id')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const ids = [...new Set([...(grants ?? []).map((g) => g.person_id), ...(logs ?? []).map((l) => l.person_id)])];
  const { data: names } = ids.length ? await sb.from('people').select('id,name').in('id', ids) : { data: [] };
  const nm = new Map((names ?? []).map((p) => [p.id, p.name]));
  const granted = new Set((grants ?? []).map((g) => g.person_id));
  const isDrive = e.storage_kind === 'Google雲端';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/evidence" className="text-sm text-accent">← 佐證索引</Link>
        <h1 className="h1 mt-1">{e.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge>{e.status}</Badge><Badge>{e.sensitivity}</Badge><Badge>{e.storage_kind}</Badge>
          <span className="text-muted">{e.id}</span>
        </div>
      </div>

      <section className="card p-5" aria-labelledby="ohead">
        <h2 id="ohead" className="h2 mb-3">調閱</h2>
        <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted">年度</dt><dd>{e.year_label ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">文件類型</dt><dd>{e.doc_type ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">版本</dt><dd>{e.version ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">組別</dt><dd>{e.department_name ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">登錄者</dt><dd>{e.uploaded_by_name ?? '—'}（{fmtDate(e.created_at)}）</dd></div>
          {isDrive && <div><dt className="text-xs text-muted">分享設定確認</dt><dd>{fmtDateTime(e.share_confirmed_at)}</dd></div>}
        </dl>
        {e.storage_kind === '未指定'
          ? <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">這份佐證是舊資料，還沒有指定存放方式，請登錄者或主任補上。</p>
          : (
            <ActionForm action={openEvidence}>
              <input type="hidden" name="doc" value={e.id} />
              <Submit>{isDrive ? '開啟 Google 雲端檔案' : '查看存放位置'}</Submit>
              <p className="hint mt-2">每次調閱都會記錄調閱者與時間。{isDrive && `開啟後若看不到檔案，代表中心雲端帳號（${EVIDENCE_DRIVE_ACCOUNT}）還沒有分享給你，請聯絡登錄者或主任。`}</p>
            </ActionForm>
          )}
      </section>

      {me.is_director && (
        <section className="card p-5" aria-labelledby="rhead">
          <h2 id="rhead" className="h2 mb-1">主任審核</h2>
          <p className="mb-3 text-sm text-muted">確認內容、年度與存放位置正確{isDrive && '，並在 Google 雲端確認分享對象只限個別同仁'}。審核有效不代表標準已符合。</p>
          {e.review_note && <p className="mb-3 text-sm">上次意見：{e.review_note}（{e.reviewer_name}，{fmtDate(e.reviewed_on)}）</p>}
          <ActionForm action={reviewEvidence} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="doc" value={e.id} />
            <div className="grow"><label className="label" htmlFor="rnote">意見（退回或失效必填）</label><input id="rnote" name="note" className="field" /></div>
            <Submit name="status" value="有效">審核有效</Submit>
            <Submit name="status" value="退回補正" variant="ghost">退回補正</Submit>
            <Submit name="status" value="已失效" variant="danger">標為失效</Submit>
          </ActionForm>
        </section>
      )}
      {!me.is_director && e.review_note && (
        <p className="card p-4 text-sm"><b>主任意見：</b>{e.review_note}（{fmtDate(e.reviewed_on)}）</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="ihead">
          <h2 id="ihead" className="h2 mb-3">關聯指標</h2>
          <ul className="space-y-1 text-sm">{(inds ?? []).map((i) => (
            <li key={i.id}><Link href={`/evaluation/item?id=${encodeURIComponent(i.id)}`} className="text-accent">{i.id}</Link> {i.name}</li>
          ))}{!inds?.length && <li className="text-muted">尚未關聯指標</li>}</ul>
          {canManage && (
            <ActionForm action={linkIndicator} className="mt-4 flex items-end gap-2" resetOnSuccess>
              <input type="hidden" name="doc" value={e.id} />
              <div className="grow"><label className="label" htmlFor="li">再關聯一個指標</label><input id="li" name="indicator" required className="field" placeholder="例：6101" /></div>
              <Submit variant="ghost">關聯</Submit>
            </ActionForm>
          )}
        </section>

        {canManage && (
          <section className="card p-5" aria-labelledby="ghead">
            <h2 id="ghead" className="h2 mb-1">調閱授權</h2>
            <p className="mb-3 text-sm text-muted">這裡管的是「平台上誰能拿到連結」。Google 雲端那邊也要分享給同一個人，才打得開檔案。</p>
            <ul className="divide-y divide-line text-sm">{(grants ?? []).map((g) => (
              <li key={g.person_id} className="flex items-center justify-between py-2">
                <span>{nm.get(g.person_id) ?? g.person_id}<span className="ml-2 text-xs text-muted">{fmtDate(g.granted_at)}</span></span>
                {g.person_id !== e.uploaded_by && (
                  <ActionForm action={revokeAccess} confirm="確定撤銷這位同仁的調閱授權？">
                    <input type="hidden" name="doc" value={e.id} /><input type="hidden" name="person" value={g.person_id} />
                    <Submit variant="ghost">撤銷</Submit>
                  </ActionForm>
                )}
              </li>
            ))}</ul>
            <ActionForm action={grantAccess} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="doc" value={e.id} />
              <div className="grow"><label className="label" htmlFor="gp">授權給</label>
                <select id="gp" name="person" required className="field" defaultValue="">
                  <option value="" disabled>— 選擇在職同仁 —</option>
                  {((people ?? []) as { id: string; name: string }[]).filter((p) => !granted.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <Submit variant="ghost">授權</Submit>
            </ActionForm>
          </section>
        )}
      </div>

      {canManage && (
        <section className="card p-5" aria-labelledby="shead">
          <details>
            <summary className="h2 cursor-pointer">修改存放位置（檔案搬家、換新版本）</summary>
            <p className="mt-2 text-sm text-muted">修改後狀態回到「待審核」，由主任重新確認。</p>
            <ActionForm action={updateStorage} className="mt-4 space-y-4">
              <input type="hidden" name="doc" value={e.id} />
              <StorageFields idPrefix="upd" defaultKind={e.storage_kind === '未指定' ? 'Google雲端' : e.storage_kind} sensitivity={e.sensitivity} />
              <div className="max-w-xs"><label className="label" htmlFor="uv">新版本</label><input id="uv" name="version" className="field" placeholder={e.version ?? '例：v2'} /></div>
              <Submit>儲存</Submit>
            </ActionForm>
          </details>
        </section>
      )}

      {me.is_director && (
        <section className="card overflow-x-auto" aria-labelledby="lhead">
          <h2 id="lhead" className="h2 border-b border-line px-4 py-3">調閱紀錄（最近 30 筆）</h2>
          <table className="w-full">
            <thead className="bg-paper"><tr><th className="th">時間</th><th className="th">調閱者</th><th className="th">動作</th></tr></thead>
            <tbody className="divide-y divide-line">{(logs ?? []).map((l, n) => (
              <tr key={n}><td className="td whitespace-nowrap">{fmtDateTime(l.at)}</td><td className="td">{nm.get(l.person_id) ?? l.person_id}</td><td className="td">{l.action}</td></tr>
            ))}{!logs?.length && <tr><td className="td text-muted" colSpan={3}>尚無調閱紀錄</td></tr>}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return <AsyncView load={EvidenceDetail as PageLoader} title="佐證詳情" />;
}
