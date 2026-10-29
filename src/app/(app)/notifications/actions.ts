import { refresh } from '@/lib/session';
import { supabaseBrowser } from '@/lib/supabase/browser';

export async function markRead(f: FormData) {
  const sb = supabaseBrowser();
  await sb.rpc('notification_mark_read', { p_id: Number(f.get('id')) });
  refresh();
}
