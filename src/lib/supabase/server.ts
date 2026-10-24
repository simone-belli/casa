import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

/** A Supabase client acting as the signed-in user of the current request. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only; the
          // proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in household member, or null if signed out or not allowed. */
export async function currentMember() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: isMember } = await supabase.rpc("is_member");
  return isMember ? { supabase, user: data.user } : null;
}
