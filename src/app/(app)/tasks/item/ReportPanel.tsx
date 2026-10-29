'use client';
import { startTransition, useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { refreshAndWait } from '@/lib/session';
import { getReportState, submitReport } from '../actions';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import type { ActionResult } from '@/lib/types';

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

type Tab = '進度回報' | '需要協助' | '申請結案';
type Draft = Record<string, string | boolean>;
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: '進度回報', label: '回報進度', hint: '這次做了什麼、下一步是什麼' },
  { key: '需要協助', label: '需要協助', hint: '卡住了、需要誰幫忙或請主任決定' },
  { key: '申請結案', label: '申請結案', hint: '已完成，送主管核定結案' },
];
const EMPTY: Record<Tab, Draft> = {
  進度回報: { status: '', accomplishment: '', next_action: '', next_action_due: '', next_followup: '' },
  需要協助: { blocker: '', support_type: '協助', support_request: '', support_needed_by: '', stalled: false },
  申請結案: { accomplishment: '', result_link: '', evidence_note: '', acceptance_confirmed: false },
};
const LABEL: Record<string, string> = {
  status: '狀態', accomplishment: '成果', next_action: '下一步行動', next_action_due: '下一步預計完成日', next_followup: '下次追蹤日',
  blocker: '目前卡點', support_type: '需要的支援', support_request: '協助需求', support_needed_by: '希望回覆日期', stalled: '工作已停擺',
  result_link: '成果連結', evidence_note: '佐證說明', acceptance_confirmed: '驗收確認',
};
const isDirty = (tab: Tab, d: Draft) => Object.keys(EMPTY[tab]).some((k) => d[k] !== EMPTY[tab][k]);

/** 把尚未送出的內容整理成純文字，方便同仁自行複製保存 */
function draftText(drafts: Record<Tab, Draft>) {
  return TABS.filter((x) => isDirty(x.key, drafts[x.key])).map((x) => {
    const d = drafts[x.key];
    const lines = Object.keys(EMPTY[x.key]).filter((k) => d[k] !== EMPTY[x.key][k])
      .map((k) => `${LABEL[k]}：${typeof d[k] === 'boolean' ? (d[k] ? '是' : '否') : d[k]}`);
    return `【${x.label}】\n${lines.join('\n')}`;
  }).join('\n\n');
}

export type ReportMode = 'active' | 'closePending' | 'locked' | 'hidden';

/**
 * 三種回報入口（progressive disclosure：只顯示該情境需要的欄位）
 * - 每個分頁各自保存尚未送出的內容（受控欄位），切換分頁不會清除；送出成功只清除該分頁。
 * - 送出期間鎖住分頁與欄位，回應只會影響「送出時的那個分頁」。
 * - 必填規則前端先擋，資料庫 RPC task_submit_report 再完整檢查（規則以資料庫為準）；同一送出編號重送不會重複寫入。
 * - 畫面過期（STALE）：提供「保留輸入並載入最新資料」，載入後由同仁確認再送出，不自動重送。
 * - 草稿只存在這個分頁的記憶體中，不寫入 localStorage 或資料庫（避免業務內容留在共用電腦）。
 * - 本元件在任務頁固定掛載（mode 控制顯示），任務狀態或權限改變時，未送出內容仍可複製保存。
 */
export function ReportPanel({ taskId, status, role, today, updatedAt, initialTab, canClose, mode, lockReason, reworkReason }: {
  taskId: string; status: string; role: string | null; today: string; updatedAt: string;
  initialTab?: Tab; canClose: boolean; mode: ReportMode; lockReason?: string; reworkReason?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab && (initialTab !== '申請結案' || canClose) ? initialTab : '進度回報');
  const [drafts, setDrafts] = useState<Record<Tab, Draft>>(() => ({ 進度回報: { ...EMPTY.進度回報 }, 需要協助: { ...EMPTY.需要協助 }, 申請結案: { ...EMPTY.申請結案 } }));
  const [requestIds, setRequestIds] = useState<Record<Tab, string>>(() => ({ 進度回報: newId(), 需要協助: newId(), 申請結案: newId() }));
  const [state, action, pending] = useActionState<ActionResult, FormData>(submitReport, null);
  const submittedTab = useRef<Tab | null>(null);
  const [shownState, setShownState] = useState<ActionResult>(null);
  const [recovering, setRecovering] = useState(false);
  const [refreshing, startRefresh] = useTransition();   // 重新載入完成前不能送出，避免用舊版本送出
  const [reloadedNote, setReloadedNote] = useState('');
  const [lostAccess, setLostAccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const base = useId();

  const anyDirty = TABS.some((x) => isDirty(x.key, drafts[x.key]));
  useUnsavedGuard(anyDirty);

  // 送出結果：只處理「送出時的分頁」
  useEffect(() => {
    if (!state) return;
    setShownState(state);
    const t = submittedTab.current;
    if (state.ok && t) {
      setDrafts((d) => ({ ...d, [t]: { ...EMPTY[t] } }));
      setRequestIds((r) => ({ ...r, [t]: newId() }));
      setReloadedNote('');
    }
    submittedTab.current = null;
  }, [state]);

  const set = (k: string, v: string | boolean) => setDrafts((d) => ({ ...d, [tab]: { ...d[tab], [k]: v } }));
  const d = drafts[tab];
  const f = (name: string) => `${base}-${name}`;
  const text = (name: string) => ({ value: d[name] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(name, e.target.value) });

  async function recover() {
    setRecovering(true);
    try {
      const r = await getReportState(taskId);
      if (!r.viewable) { setLostAccess(true); setShownState(null); return; }
      setShownState(null);
      setReloadedNote(`已載入最新資料（目前狀態：${r.status}）。你的輸入都還在，請確認內容是否仍適用，再按送出。`);
      startRefresh(async () => { await refreshAndWait(); });
    } finally {
      setRecovering(false);
    }
  }

  async function copyDrafts() {
    const t = draftText(drafts);
    try { await navigator.clipboard.writeText(t); setCopied(true); } catch { setCopied(false); }
  }

  const effectiveMode: ReportMode = lostAccess ? 'locked' : mode;
  const effectiveReason = lostAccess ? '你目前無法再查看或回報這項工作（可能已被移出或權限已變更），因此不會重新送出。' : lockReason;

  if (effectiveMode !== 'active') {
    if (effectiveMode === 'hidden' && !anyDirty) return null;
    return (
      <section id="report" className="card scroll-mt-20 p-4" aria-label="回報">
        <h2 className="h2 mb-3">回報</h2>
        {shownState?.ok && <p role="status" className="mb-2 rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{shownState.message}</p>}
        {effectiveMode === 'closePending' && !lostAccess
          ? <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">已申請結案，正在等候主管核定。核定結果出來前不需要再回報；如被退回，這裡會出現補件入口。</p>
          : <p role="alert" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{effectiveReason ?? '目前不能回報這項工作。'}</p>}
        {anyDirty && (
          <div className="mt-3 space-y-2" data-unsent>
            <p className="text-sm">你還有<b>尚未送出</b>的內容，系統不會自動重送。可以複製保存，再視情況通知主責或主管：</p>
            <label className="label" htmlFor={f('copy')}>尚未送出的內容</label>
            <textarea id={f('copy')} readOnly value={draftText(drafts)} rows={6} className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copyDrafts} className="btn-ghost min-h-11">{copied ? '已複製' : '複製內容'}</button>
          </div>
        )}
      </section>
    );
  }

  const tabs = TABS.filter((x) => x.key !== '申請結案' || canClose);
  const stale = shownState && !shownState.ok && shownState.code === 'STALE';

  return (
    <section id="report" className="card scroll-mt-20 p-4" aria-label="回報">
      <h2 className="h2 mb-3">回報</h2>
      <div role="tablist" aria-label="回報類型" className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
        {tabs.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} aria-controls={`${base}-panel`}
                  aria-disabled={pending || undefined}
                  onClick={() => { if (!pending) setTab(x.key); }}
                  className={`relative min-h-11 rounded-md px-2 text-sm font-medium ${tab === x.key ? 'bg-card text-accent shadow-sm' : 'text-muted hover:text-ink'} ${pending ? 'cursor-not-allowed' : ''}`}>
            {x.label}
            {isDirty(x.key, drafts[x.key]) && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-warn align-middle" aria-label="（有未送出內容）" />}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">{TABS.find((x) => x.key === tab)!.hint}{!canClose && role === '協作' ? '。申請結案由主責提出。' : ''}{anyDirty ? '。切換分頁不會清除已填內容。' : ''}</p>

      {refreshing && <p role="status" className="mb-3 rounded-lg bg-paper px-3 py-2 text-sm text-muted">正在載入最新資料…</p>}
      {reloadedNote && !refreshing && <p role="status" className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">{reloadedNote}</p>}

      <form
        id={`${base}-panel`}
        role="tabpanel"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending || refreshing || recovering) return;
          const fd = new FormData();
          fd.set('id', taskId);
          fd.set('type', tab);
          fd.set('client_request_id', requestIds[tab]);
          fd.set('expected_updated_at', updatedAt);
          for (const [k, v] of Object.entries(drafts[tab])) {
            if (typeof v === 'boolean') { if (v) fd.set(k, 'true'); } else if (v) fd.set(k, v);
          }
          submittedTab.current = tab;
          setShownState(null);
          startTransition(() => action(fd));
        }}
      >
        <fieldset disabled={pending || refreshing || recovering} className="space-y-3">
        {tab === '進度回報' && (
          <>
            <div>
              <label className="label" htmlFor={f('st')}>狀態</label>
              <select id={f('st')} {...text('status')} className="field">
                <option value="">（{status === '受阻' ? '恢復為：進行中' : `不變：${status}`}）</option>
                <option>待處理</option><option>進行中</option><option>待外部回覆</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor={f('acc')}>本次完成成果 <span className="text-danger">*</span></label>
              <textarea id={f('acc')} {...text('accomplishment')} required minLength={2} maxLength={2000} rows={2} className="field" placeholder="這次具體完成了什麼" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <div>
                <label className="label" htmlFor={f('next')}>下一步行動 <span className="text-danger">*</span></label>
                <input id={f('next')} {...text('next_action')} required minLength={2} maxLength={1000} className="field" />
              </div>
              <div>
                <label className="label" htmlFor={f('nd')}>下一步預計完成日 <span className="text-danger">*</span></label>
                <input id={f('nd')} type="date" {...text('next_action_due')} required min={today} className="field" />
              </div>
            </div>
            {d.status === '待外部回覆' && (
              <div><label className="label" htmlFor={f('nf')}>下次追蹤日 <span className="text-danger">*</span></label>
                <input id={f('nf')} type="date" {...text('next_followup')} required min={today} className="field" /></div>
            )}
            <p className="hint">下一步日期只是工作安排，<b>不會改變正式期限</b>；要調整期限請用「申請變更期限」。</p>
          </>
        )}

        {tab === '需要協助' && (
          <>
            <div>
              <label className="label" htmlFor={f('blk')}>目前卡點 <span className="text-danger">*</span></label>
              <textarea id={f('blk')} {...text('blocker')} required minLength={2} maxLength={2000} rows={2} className="field" placeholder="卡在哪裡、在等誰" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <div>
                <label className="label" htmlFor={f('stype')}>需要的支援</label>
                <select id={f('stype')} {...text('support_type')} className="field"><option>協助</option><option>主任決策</option></select>
              </div>
              <div>
                <label className="label" htmlFor={f('sup')}>需要的協助或要請主任決定的事 <span className="text-danger">*</span></label>
                <input id={f('sup')} {...text('support_request')} required minLength={2} maxLength={1000} className="field" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={f('need')}>希望回覆日期 <span className="text-danger">*</span></label>
                <input id={f('need')} type="date" {...text('support_needed_by')} required min={today} className="field" />
              </div>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={d.stalled as boolean} onChange={(e) => set('stalled', e.target.checked)} className="h-5 w-5" /> 工作已停擺（狀態改為「受阻」）
              </label>
            </div>
            <p className="hint">選「主任決策」會進入主任的決策佇列；選「協助」會出現在主任首頁的「需要督導或跨組協助」。</p>
          </>
        )}

        {tab === '申請結案' && (
          <>
            {reworkReason && (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger"><b>上次退回原因：</b>{reworkReason}<br />請針對退回原因補齊後再送出，這次申請會與上次連結。</p>
            )}
            <div>
              <label className="label" htmlFor={f('del')}>交付成果 <span className="text-danger">*</span></label>
              <textarea id={f('del')} {...text('accomplishment')} required minLength={2} maxLength={2000} rows={3} className="field" placeholder="完成了哪些成果、對應哪些要求" />
            </div>
            <div>
              <label className="label" htmlFor={f('link')}>成果連結（受控位置）</label>
              <input id={f('link')} type="url" {...text('result_link')} className="field" placeholder="https://…" aria-describedby={f('evhint')} />
            </div>
            <div>
              <label className="label" htmlFor={f('ev')}>佐證說明</label>
              <input id={f('ev')} {...text('evidence_note')} maxLength={1000} className="field" placeholder="例：簽到表正本已交行政組，第 3 櫃" aria-describedby={f('evhint')} />
              <p id={f('evhint')} className="hint">成果連結與佐證說明<b>至少填一項</b>。請勿上傳個案姓名、病歷等可識別資料。</p>
            </div>
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" checked={d.acceptance_confirmed as boolean} onChange={(e) => set('acceptance_confirmed', e.target.checked)} required className="mt-0.5 h-5 w-5" />
              <span>我確認已依交辦要求與驗收條件完成，資料可供主管查核。<span className="text-danger"> *</span></span>
            </label>
          </>
        )}

        <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto">
          {pending ? '送出中…' : tab === '申請結案' ? (reworkReason ? '補件後重新申請結案' : '申請結案') : tab === '需要協助' ? '送出協助需求' : '送出回報'}
        </button>
        </fieldset>

        {shownState && !stale && (
          <p role={shownState.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${shownState.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>
            {shownState.message}{!shownState.ok && '（已填內容仍保留，修正後可再送出）'}
          </p>
        )}
        {stale && (
          <div role="alert" className="space-y-2 rounded-lg bg-warn-soft px-3 py-3 text-sm text-warn">
            <p><b>這項工作剛被其他人更新</b>（例如主管核定或同仁回報），為了不覆蓋對方的變更，這次沒有送出。</p>
            <p>按下方按鈕會重新載入最新狀態與權限，<b>你填的內容會保留</b>；確認後再自行送出。</p>
            <button type="button" onClick={recover} disabled={recovering} className="btn-primary min-h-11">
              {recovering ? '載入中…' : '保留輸入並載入最新資料'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
