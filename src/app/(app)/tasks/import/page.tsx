'use client';
import { AsyncView, type PageLoader } from '@/components/AsyncView';
import { DownloadButton } from '@/components/DownloadButton';
import Link from 'next/link';
import { requireMe, hasRole } from '@/lib/session';
import { ImportFlow } from './ImportFlow';

async function ImportTasks() {
  const { me } = await requireMe();
  const manager = me.is_director || hasRole(me, 'dept_lead');
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link href="/tasks" className="text-sm text-accent">← 工作管理</Link>
        <h1 className="h1 mt-1">{manager ? '批量匯入工作' : '批量提報工作'}</h1>
        <p className="mt-1 text-sm text-muted">
          用 Excel 一次建立多項工作。匯入後一律是<strong>「待主任核定」草案</strong>，不會通知任何人；
          {me.is_director ? '請到「決策佇列」勾選後批次核定，才會成為正式交辦。' : '主任核定後才會成為正式交辦。'}
        </p>
      </div>
      {!manager && (
        <div className="card border-l-4 border-l-accent p-4 text-sm">
          <b>同仁提報規則：</b>和「提報工作」相同。組別只能填自己的組別；主責人只能填自己或留空（由主任核定時指定）；一次最多 100 筆。
        </div>
      )}
      <ol className="card space-y-1 p-4 text-sm">
        <li><strong>1.</strong> 下載範本，在「工作匯入」工作表逐列填寫（「可指派同仁」「可填組別」「評鑑指標」工作表可對照）。</li>
        <li><strong>2.</strong> 上傳檔案，系統逐列檢查：組別權限、在職狀態（留停者不可指派）、日期、指標編號。</li>
        <li><strong>3.</strong> 預覽沒有錯誤後按「確認匯入」。任一列有錯誤，整批都不會寫入。</li>
      </ol>
      <DownloadButton job={{ kind: 'template' }}>⬇ 下載匯入範本</DownloadButton>
      <ImportFlow isDirector={me.is_director} maxRows={manager ? 500 : 100} />
    </div>
  );
}

export default function Page() {
  return <AsyncView load={ImportTasks as PageLoader} title="批量匯入工作" />;
}
