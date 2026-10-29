import Link from 'next/link';
import { Suspense } from 'react';
import { NavLink } from './NavLink';
import { MobileNav } from './MobileNav';
import { ROLE_LABEL } from '@/lib/format';
import { SignOutButton } from './SignOutButton';
import { asset } from '@/lib/supabase/browser';
import type { Me } from '@/lib/types';

export function AppShell({ me, unread, pending, children }: { me: Me; unread: number; pending: number; children: React.ReactNode }) {
  const isCoord = me.roles.some((r) => r.role === 'eval_coordinator');
  const isLead = me.roles.some((r) => r.role === 'dept_lead');
  const nav = (
    <nav aria-label="主選單" className="flex flex-col gap-1">
      <NavLink href="/">{me.is_director ? '主任儀表板' : '我的首頁'}</NavLink>
      <NavLink href="/tasks">工作管理</NavLink>
      {(me.is_director || isLead) && <NavLink href="/approvals" badge={pending}>決策佇列</NavLink>}
      <NavLink href="/evaluation" exclude="/evaluation/board">評鑑中心</NavLink>
      {(me.is_director || isCoord) && <NavLink href="/evaluation/board">教保評鑑追蹤</NavLink>}
      <NavLink href="/improvements">缺失與改善</NavLink>
      <NavLink href="/evidence">佐證索引</NavLink>
      {(me.is_director || isLead) && <NavLink href="/reports">週報／月報</NavLink>}
      <NavLink href="/people">{me.is_director ? '組織人員' : '同仁名錄'}</NavLink>
      <NavLink href="/notifications" badge={unread}>通知</NavLink>
      {me.is_director && (
        <>
          <div className="mt-3 px-3 text-xs font-semibold text-muted">管理</div>
          <NavLink href="/import">資料匯入</NavLink>
          <NavLink href="/audit">操作日誌</NavLink>
        </>
      )}
    </nav>
  );
  const roles = me.roles.map((r) => ROLE_LABEL[r.role] + (r.department_id ? `（${r.department_id}）` : '')).join('、') || '一般同仁';
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 btn-primary">跳到主要內容</a>
      <aside className="relative hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-card md:px-3 md:py-5 md:sticky md:top-0 md:h-screen">
        <div aria-hidden className="brand-stripe absolute inset-x-0 top-0 h-1" />
        <Link href="/" className="mb-6 block px-1" aria-label="臺北市大同發展中心 營運暨評鑑追蹤平台（回首頁）">
          {/* logo 為白底，深色模式下以白色底板呈現，維持 CI 原貌 */}
          <span className="block rounded-lg bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset('/brand/logo-horizontal.png')} alt="臺北市大同發展中心" width={720} height={157} className="h-auto w-full" />
          </span>
          <span className="mt-2 block px-2 text-xs font-medium tracking-wide text-muted">營運暨評鑑追蹤平台</span>
        </Link>
        {nav}
        <div className="mt-auto border-t border-line px-3 pt-4 text-sm">
          <div className="font-semibold">{me.name}</div>
          <div className="text-xs text-muted">{roles}</div>
          <div className="mt-2"><SignOutButton /></div>
        </div>
      </aside>
      <Suspense fallback={null}>
        <MobileNav summary={
          <>
            <div aria-hidden className="brand-stripe absolute inset-x-0 top-0 h-1" />
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 font-bold">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset('/brand/logo-mark.png')} alt="" width={28} height={28} className="h-7 w-7" />
                大同發展中心
              </span>
              <span className="text-sm text-muted">{me.name}・選單 ☰</span>
            </summary>
          </>
        }>
          <div className="px-3 pb-3">
            {nav}
            <div className="mt-2 px-3"><SignOutButton className="min-h-11 text-sm text-accent" /></div>
          </div>
        </MobileNav>
      </Suspense>
      <main id="main" tabIndex={-1} className="outline-none min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
