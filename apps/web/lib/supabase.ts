import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | undefined;

/**
 * Service-role client. The control plane is the sole writer (RLS default-deny);
 * this client must never be constructed in client-side code.
 */
export function serviceClient(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });
  }
  return client;
}
