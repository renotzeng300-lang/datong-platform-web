'use client';
import { useEffect } from 'react';

export const UNSAVED_MESSAGE = '你有尚未送出的內容，離開後會遺失。確定要離開嗎？';

/**
 * 未送出內容的離頁保護（只在 dirty 時生效）
 * - 重新整理／關閉分頁／輸入網址：瀏覽器原生 beforeunload 提示。
 *   瀏覽器限制：提示文字由瀏覽器決定，無法自訂；部分手機瀏覽器（例如 iOS Safari 切換 App）不一定會提示。
 * - 站內連結（側邊選單、麵包屑、卡片連結）：攔截點擊，先確認再離開。
 * - 瀏覽器「上一頁」：Next.js App Router 沒有可取消的路由事件，無法攔截；草稿只存在這個分頁的記憶體中。
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;               // 外部連結另開或由瀏覽器處理
      if (url.pathname === location.pathname && url.search === location.search) return; // 同頁錨點
      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);           // capture：比 Next.js Link 先處理
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
