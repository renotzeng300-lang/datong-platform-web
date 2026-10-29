import Link from 'next/link';
import { Badge } from './Badge';
import { fmtDate } from '@/lib/format';
import type { BoardItem } from '@/lib/board';

/** 一筆提醒：標題、觸發原因（具體）、主責與期限 */
export function BoardItemRow({ it, compact = false }: { it: BoardItem; compact?: boolean }) {
  const href = it.decision_id ? (it.task_id ? `/tasks/item?id=${encodeURIComponent(it.task_id ?? '')}` : '/approvals') : `/tasks/item?id=${encodeURIComponent(it.task_id ?? '')}`;
  return (
    <li className={compact ? 'py-2' : 'card p-3'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={href} className="font-medium hover:underline">{it.title}</Link>
        {it.risk_category && <Badge tone={it.risk_severity === '高' ? '逾期' : it.risk_severity === '中' ? '高' : undefined}>{`${it.risk_category}・${it.risk_severity}`}</Badge>}
        {!compact && it.status && <Badge>{it.status}</Badge>}
      </div>
      <ul className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-danger">
        {it.reasons.slice(0, compact ? 2 : 10).map((r) => <li key={r}>• {r}</li>)}
      </ul>
      {!compact && (
        <div className="mt-1 text-xs text-muted">
          {it.department_name ?? '—'}・主責 {it.owner_name ?? '未指定'}{it.due_on && <>・期限 {fmtDate(it.due_on)}</>}
        </div>
      )}
    </li>
  );
}
