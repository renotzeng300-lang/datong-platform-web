const TONE: Record<string, string> = {
  待分派: 'bg-hold-soft text-hold',
  待處理: 'bg-accent-soft text-accent',
  進行中: 'bg-accent-soft text-accent',
  受阻: 'bg-danger-soft text-danger',
  待外部回覆: 'bg-warn-soft text-warn',
  待主管核定: 'bg-warn-soft text-warn',
  已結案: 'bg-ok-soft text-ok',
  已取消: 'bg-line text-muted',
  待主任核定: 'bg-hold-soft text-hold',
  已核定: 'bg-ok-soft text-ok',
  退回: 'bg-danger-soft text-danger',
  在職: 'bg-ok-soft text-ok',
  待確認: 'bg-warn-soft text-warn',
  留職停薪: 'bg-danger-soft text-danger',
  離職: 'bg-line text-muted',
  高度限制: 'bg-danger-soft text-danger',
  限組別: 'bg-warn-soft text-warn',
  逾期: 'bg-danger-soft text-danger',
  緊急: 'bg-danger-soft text-danger',
  高: 'bg-warn-soft text-warn',
  // Sprint 2：評鑑品質
  符合: 'bg-ok-soft text-ok',
  部分符合: 'bg-warn-soft text-warn',
  不符合: 'bg-danger-soft text-danger',
  待檢核: 'bg-line text-muted',
  待確認不適用: 'bg-hold-soft text-hold',
  齊備: 'bg-ok-soft text-ok',
  部分齊備: 'bg-warn-soft text-warn',
  未盤點: 'bg-line text-muted',
  已複核: 'bg-ok-soft text-ok',
  未複核: 'bg-warn-soft text-warn',
  待複核: 'bg-warn-soft text-warn',
  確認適評: 'bg-ok-soft text-ok',
  已申請不適評: 'bg-hold-soft text-hold',
  核准不適評: 'bg-hold-soft text-hold',
  待改善: 'bg-danger-soft text-danger',
  改善中: 'bg-warn-soft text-warn',
  有效: 'bg-ok-soft text-ok',
  部分有效: 'bg-warn-soft text-warn',
  無效: 'bg-danger-soft text-danger',
  // 佐證索引
  待審核: 'bg-warn-soft text-warn',
  退回補正: 'bg-danger-soft text-danger',
  已失效: 'bg-line text-muted',
  待提供: 'bg-line text-muted',
  // 通知信
  待寄送: 'bg-warn-soft text-warn',
  寄送中: 'bg-accent-soft text-accent',
  已寄送: 'bg-ok-soft text-ok',
  寄送失敗: 'bg-danger-soft text-danger',
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const key = tone ?? (typeof children === 'string' ? children : '');
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${TONE[key] ?? 'bg-paper text-muted border border-line'}`}>
      {children}
    </span>
  );
}
