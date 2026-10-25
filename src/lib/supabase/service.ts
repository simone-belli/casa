import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

let client: SupabaseClient | undefined;

/**
 * A Supabase client with the secret (service role) key: it bypasses row
 * level security, so it's only used by the server for Google sync.
 */
export function supabaseService(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY isn't set.");
  client ??= createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
