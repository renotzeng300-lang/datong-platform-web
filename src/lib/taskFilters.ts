// 工作清單與匯出共用的篩選條件：兩邊永遠一致。資料範圍仍由資料庫 RLS 決定。
import type { Me } from './types';

export const TASK_FILTERS: Record<string, string> = {
  overdue: '已逾期', due7: '7 日內到期', due14: '14 日內到期', awaiting_approval: '待主任核定交辦',
  awaiting_close: '待核定結案', external: '待外部回覆', stale: '超過 7 日未更新', no_owner: '無主責人',
  handoff: '待交接', formal: '進行中正式工作', mine: '我負責的',
};

export type TaskSearch = { filter?: string; department?: string; owner?: string; indicator?: string; status?: string; q?: string;
  /** 依人員搜尋：person＝人員ID；prole＝owner（只看主責）／collab（只看協作）／空白（主責或協作） */
  person?: string; prole?: string };

export const PERSON_ROLES: Record<string, string> = { '': '主責或協作', owner: '只看主責', collab: '只看協作' };

/** 依人員搜尋時，先查出此人擔任協作的工作編號（清單與匯出共用） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collabTaskIds(sb: any, sp: TaskSearch): Promise<string[]> {
  if (!sp.person || sp.prole === 'owner') return [];
  const { data } = await sb.from('task_collaborators').select('task_id').eq('person_id', sp.person).is('removed_at', null).limit(2000);
  return [...new Set(((data ?? []) as { task_id: string }[]).map((r) => r.task_id))];
}
const safeId = (v: string) => v.replace(/[^\w-]/g, '');

const OPEN = '("已結案","已取消")';
const FORMAL = ['已核定', '免核定'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTaskFilters<Q extends Record<string, any>>(q: Q, sp: TaskSearch, me: Me, collabIds: string[] = []): Q {
  let x = q as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (sp.filter) {
    case 'overdue': x = x.eq('is_overdue', true).in('approval_status', FORMAL); break;
    case 'due7': x = x.eq('due_in_7', true).in('approval_status', FORMAL); break;
    case 'due14': x = x.eq('due_in_14', true).in('approval_status', FORMAL); break;
    case 'awaiting_approval': x = x.eq('approval_status', '待主任核定').not('status', 'in', OPEN); break;
    case 'awaiting_close': x = x.eq('status', '待主管核定'); break;
    case 'external': x = x.eq('status', '待外部回覆'); break;
    case 'stale': x = x.in('approval_status', FORMAL).not('status', 'in', OPEN).lt('last_activity_at', new Date(Date.now() - 7 * 864e5).toISOString()); break;
    case 'no_owner': x = x.is('owner_person_id', null).not('status', 'in', OPEN); break;
    case 'handoff': x = x.eq('needs_handoff', true).not('status', 'in', OPEN); break;
    case 'formal': x = x.in('approval_status', FORMAL).not('status', 'in', OPEN); break;
    case 'mine': x = x.eq('owner_person_id', me.person_id); break;
  }
  if (sp.department) x = x.eq('department_id', sp.department);
  if (sp.owner) x = x.eq('owner_person_id', sp.owner);
  if (sp.person) {
    const pid = safeId(sp.person);
    const ids = collabIds.map(safeId).filter(Boolean);
    const inIds = `id.in.(${ids.length ? ids.join(',') : '__none__'})`;
    if (sp.prole === 'owner') x = x.eq('owner_person_id', pid);
    else if (sp.prole === 'collab') x = x.or(inIds);
    else x = x.or(`owner_person_id.eq.${pid},${inIds}`);
  }
  if (sp.indicator) x = x.contains('indicator_ids', [sp.indicator]);
  if (sp.status) x = x.eq('status', sp.status);
  if (sp.q) x = x.ilike('title', `%${sp.q.replace(/[%_]/g, '')}%`);
  return x as Q;
}

/** 把目前的篩選條件轉成網址參數（給「匯出」按鈕用） */
export function searchToQuery(sp: TaskSearch): string {
  const u = new URLSearchParams();
  for (const k of ['filter', 'department', 'owner', 'person', 'prole', 'indicator', 'status', 'q'] as const) if (sp[k]) u.set(k, sp[k]!);
  const s = u.toString();
  return s ? `?${s}` : '';
}
