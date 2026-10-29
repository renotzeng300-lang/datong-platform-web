'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children, badge, exclude }: { href: string; children: React.ReactNode; badge?: number; exclude?: string }) {
  const path = usePathname();
  const active = (href === '/' ? path === '/' : path.startsWith(href)) && !(exclude && path.startsWith(exclude));
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-[15px] ${active ? 'bg-accent text-on-accent font-semibold shadow-[inset_4px_0_0_var(--color-brand-yellow)]' : 'text-ink hover:bg-paper'}`}>
      <span>{children}</span>
      {badge ? <span className={`ml-2 rounded-full px-2 text-xs font-bold ${active ? 'bg-white/25' : 'bg-danger-soft text-danger'}`}>{badge}</span> : null}
    </Link>
  );
}
