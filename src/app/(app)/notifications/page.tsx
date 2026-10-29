'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';
import { deriveNotifyState, type NotifyDecision, type NotifyState } from '@/lib/notifyState';
import { markRead } from './actions';

const TONE: Record<NotifyState['tone'], string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  muted: 'bg-paper text-muted border border-line',
};

type N = { id: number; kind: string; title: string; body: string | null; entity_type: string | null; entity_id: string | null; created_at: string; read_at: string | null };

async function Notifications() {
  const { sb } = await requireMe();
  const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  const list = (data ?? []) as N[];

  // 目前處理狀態：以登入者身分重新讀取任務與申請紀錄（受 RLS 限制），不信任通知內容
  const ids = [...new Set(list.filter((n) => n.entity_type === 'task' && n.entity_id).map((n) => n.entity_id!))];
  const [{ data: tasks }, { data: decisions }] = ids.length
    ? await Promise.all([
        sb.from('v_tasks').select('id,status,approval_status').in('id', ids),
        sb.from('decisions').select('id,entity_id,kind,decision,requested_by,requested_at,decided_at,parent_decision_id').eq('entity_type', 'task').in('entity_id', ids),
      ])
    : [{ data: [] }, { data: [] }];
  const taskOf = new Map((tasks ?? []).map((t) => [t.id as string, t as { status: string; approval_status: string }]));
  const decOf = new Map<string, NotifyDecision[]>();
  for (const d of (decisions ?? []) as (NotifyDecision & { entity_id: string })[]) {
    decOf.set(d.entity_id, [...(decOf.get(d.entity_id) ?? []), d]);
  }
  const rows = list.map((n) => ({ n, s: deriveNotifyState(n, n.entity_id ? taskOf.get(n.entity_id) ?? null : null, n.entity_id ? decOf.get(n.entity_id) ?? [] : []) }));
  const openCount = rows.filter((r) => r.s?.open).length;
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="h1">站內通知</h1>
        <p className="text-sm text-muted">通知內容是當時發生的事；「目前狀態」依最新資料即時判斷。<b>已讀不代表已處理</b>。</p>
        <p className="mt-2 text-sm" data-summary>未讀 <b>{unread}</b> 則・仍需處理 <b className={openCount ? 'text-danger' : ''}>{openCount}</b> 則</p>
      </header>
      <ul className="card divide-y divide-line">
        {rows.map(({ n, s }) => (
          <li key={n.id} data-notification={n.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className={`font-medium ${n.read_at ? 'text-muted' : ''}`}>
                {!n.read_at && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger" aria-hidden />}
                <span className="sr-only">{n.read_at ? '已讀：' : '未讀：'}</span>{n.title}
              </div>
              {n.body && <p className={`text-sm ${n.read_at ? 'text-muted' : ''}`}>{n.body}</p>}
              <div className="text-xs text-muted">{fmtDateTime(n.created_at)}・{n.read_at ? '已讀' : '未讀'}</div>
              {s && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm" data-state={s.open ? 'open' : 'resolved'}>
                  <span className="text-xs text-muted">目前狀態</span>
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${TONE[s.tone]}`}>{s.label}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {s && n.entity_id && taskOf.has(n.entity_id) && (
                <Link href={`/tasks/item?id=${encodeURIComponent(n.entity_id)}`} className={`${s.open ? 'btn-primary' : 'btn-ghost'} inline-flex min-h-11 items-center text-sm`}>
                  {s.open && s.cta ? s.cta : '查看工作'}
                </Link>
              )}
              {n.entity_id && (n.entity_type === 'evidence' || n.entity_type === 'finding') && (
                <Link href={n.entity_type === 'evidence' ? `/evidence/item?id=${encodeURIComponent(n.entity_id)}` : `/improvements/item?id=${encodeURIComponent(n.entity_id)}`}
                      className="btn-ghost inline-flex min-h-11 items-center text-sm">
                  {n.entity_type === 'evidence' ? '查看佐證' : '查看缺失'}
                </Link>
              )}
              {!n.read_at && <form action={markRead}><input type="hidden" name="id" value={n.id} /><button className="btn-ghost min-h-11 text-sm">標為已讀</button></form>}
            </div>
          </li>
        ))}
        {!list.length && <li className="px-4 py-6 text-center text-muted">沒有通知。</li>}
      </ul>
    </div>
  );
}

export default function Page() {
  return <AsyncView load={Notifications as PageLoader} title="通知" />;
}
