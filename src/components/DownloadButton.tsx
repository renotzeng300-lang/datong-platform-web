'use client';
import { useState } from 'react';
import { downloadImportTemplate, downloadReport, exportTasks } from '@/lib/exports';
import type { TaskSearch } from '@/lib/taskFilters';

type Job = { kind: 'tasks'; search: TaskSearch } | { kind: 'template' } | { kind: 'report'; period: string; from?: string; to?: string };

/** 下載 Excel 按鈕：在瀏覽器產生檔案，失敗時顯示中文原因 */
export function DownloadButton({ job, children, className = 'btn-ghost' }: { job: Job; children: React.ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={className} aria-disabled={busy} onClick={async () => {
        if (busy) return;
        setBusy(true); setErr(null);
        try {
          if (job.kind === 'tasks') await exportTasks(job.search);
          else if (job.kind === 'template') await downloadImportTemplate();
          else await downloadReport(job.period, job.from, job.to);
        } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
        finally { setBusy(false); }
      }}>{busy ? '產生中…' : children}</button>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </span>
  );
}
