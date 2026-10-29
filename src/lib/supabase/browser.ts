'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 網頁直接連 Supabase（GitHub Pages 純網頁，沒有網站伺服器）。
 * 只用 anon（publishable）金鑰；所有權限由資料庫 RLS 與資料庫函式把關，和原本伺服器版完全相同。
 * 登入狀態存在瀏覽器；flowType implicit：讓主任在 Supabase 後台寄出的邀請信／重設密碼連結可直接登入。
 */
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'datong-platform-auth' },
    });
  }
  return client;
}

/** 網站子路徑（GitHub Pages 例：/datong-platform）；用於 <img src> 等不經 Next 處理的網址 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (p: string) => `${BASE_PATH}${p}`;
