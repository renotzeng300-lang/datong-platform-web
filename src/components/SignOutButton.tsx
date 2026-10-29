'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { setSession } from '@/lib/session';

export function SignOutButton({ className = 'text-sm text-accent underline-offset-2 hover:underline' }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={async () => {
      await supabaseBrowser().auth.signOut();
      setSession(null);
      router.replace('/login');
    }}>登出</button>
  );
}
