import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service role key — bypasses RLS.
 * Use for admin operations in server components, server actions, and API
 * routes. NEVER import from a client component ("use client" file).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
