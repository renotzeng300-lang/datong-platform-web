'use client';
import { useState } from 'react';
import { EVIDENCE_DRIVE_ACCOUNT } from '@/lib/org';

const KINDS = [
  { v: 'Google雲端', hint: '檔案放在中心的 Google 雲端硬碟，平台只存連結' },
  { v: '中心實體檔案', hint: '紙本或上鎖檔案櫃，記錄櫃位與編號' },
  { v: '其他系統', hint: '例如衛福部系統、會計系統，記錄系統名稱與查詢方式' },
] as const;

/** 佐證存放方式：依選擇顯示「Google 連結＋分享確認」或「存放位置」。規則最終由資料庫檢查。 */
export function StorageFields({ idPrefix = 'st', defaultKind = 'Google雲端', sensitivity }: {
  idPrefix?: string; defaultKind?: string; sensitivity?: string;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [sens, setSens] = useState(sensitivity ?? '一般內部');
  const restricted = sens === '高度限制';
  const effective = restricted && kind === 'Google雲端' ? '中心實體檔案' : kind;
  return (
    <div className="space-y-4">
      {sensitivity === undefined && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-sens`}>密級 <span className="text-danger">*</span></label>
          <select id={`${idPrefix}-sens`} name="sensitivity" className="field" value={sens} onChange={(e) => setSens(e.target.value)}>
            <option>一般內部</option><option>限組別</option><option>高度限制</option>
          </select>
          <p className="hint">「高度限制」：含服務對象姓名、病歷、ISP、家庭或申訴內容。這類資料不放雲端。</p>
        </div>
      )}
      <fieldset>
        <legend className="label">存放方式 <span className="text-danger">*</span></legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => {
            const disabled = restricted && k.v === 'Google雲端';
            return (
              <label key={k.v} className={`flex min-h-11 cursor-pointer gap-2 rounded-lg border p-3 text-sm ${effective === k.v ? 'border-accent bg-accent-soft' : 'border-line bg-card'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input type="radio" name="storage_kind" value={k.v} checked={effective === k.v} disabled={disabled}
                       onChange={() => setKind(k.v)} className="mt-0.5" />
                <span><b>{k.v}</b><span className="block text-xs text-muted">{disabled ? '高度限制資料不可放雲端' : k.hint}</span></span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {effective === 'Google雲端' ? (
        <div className="space-y-3 rounded-lg border border-line bg-paper p-4">
          <div>
            <label className="label" htmlFor={`${idPrefix}-url`}>Google 雲端連結 <span className="text-danger">*</span></label>
            <input id={`${idPrefix}-url`} name="url" type="url" required inputMode="url" className="field"
                   placeholder="https://drive.google.com/file/d/…" pattern="https://(drive|docs)\.google\.com/.*" />
            <p className="hint">檔案請放在中心雲端帳號 <b>{EVIDENCE_DRIVE_ACCOUNT}</b> 的雲端硬碟，不要放個人帳號。對檔案按右鍵 →「分享」→「複製連結」。只接受 drive.google.com 或 docs.google.com。</p>
          </div>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="share_confirmed" required className="mt-1" />
            <span>我已確認這個檔案<b>沒有</b>開啟「知道連結的任何人」，只分享給需要的個別同仁帳號。</span>
          </label>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor={`${idPrefix}-loc`}>存放位置 <span className="text-danger">*</span></label>
          <input id={`${idPrefix}-loc`} name="location" required className="field"
                 placeholder={effective === '中心實體檔案' ? '例：教保組上鎖檔案櫃 B-2／113 ISP 抽樣' : '例：衛福部身障機構系統／機構查詢頁'} />
          <p className="hint">這段文字和連結一樣受保護，只有授權者調閱時才看得到，並會留下紀錄。</p>
        </div>
      )}
    </div>
  );
}
