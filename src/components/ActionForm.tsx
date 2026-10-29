'use client';
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/types';

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

const PendingContext = createContext<boolean | null>(null);

/**
 * 所有寫入表單共用：送出 → 伺服器端 RPC（資料庫再檢查權限）→ 顯示結果訊息
 * 以 onSubmit 自行組 FormData（含被按下的按鈕 name/value），原因：
 *  1. 同一表單有「核定／退回」兩個按鈕時，確保按鈕值一定送出（先前會遺失，造成空值錯誤）
 *  2. 送出失敗時保留已填內容（不自動清空表單）
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false, confirm,
}: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; confirm?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return; // 處理中不重複送出
          if (confirm && !window.confirm(confirm)) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const fd = new FormData(e.currentTarget, submitter ?? undefined);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {state && (
          <p role={state.ok ? 'status' : 'alert'}
             className={`mt-2 rounded-lg px-3 py-2 text-sm ${state.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>
            {state.message}
          </p>
        )}
      </form>
    </PendingContext.Provider>
  );
}

export function Submit({ children, variant = 'primary', name, value }: { children: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger'; name?: string; value?: string }) {
  const ctx = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = ctx ?? formPending;
  return (
    <button type="submit" name={name} value={value} aria-disabled={pending}
            className={variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost'}>
      {pending ? '處理中…' : children}
    </button>
  );
}
