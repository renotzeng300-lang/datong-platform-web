'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * 手機版選單（<details>，保留原生的展開／收合語意）
 * - 路由切換完成後自動收合，焦點移到主要內容，避免焦點留在已隱藏的選單項目上。
 * - 只在選單是展開狀態時處理，不影響桌面版導覽。
 */
export function MobileNav({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  const search = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const d = ref.current;
    if (!d?.open) return;
    d.open = false;
    const main = document.getElementById('main');
    const target = (main?.querySelector('h1') as HTMLElement | null) ?? main;
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: false });
    }
  }, [path, search]);

  return (
    <details ref={ref} data-mobile-nav className="relative md:hidden border-b border-line bg-card"
             onKeyDown={(e) => {
               if (e.key === 'Escape' && ref.current?.open) {
                 ref.current.open = false;
                 ref.current.querySelector('summary')?.focus();
               }
             }}>
      {summary}
      {children}
    </details>
  );
}
