import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Browser-safe client: anon key, subject to row-level security. Used for public reads and Realtime.
export function publicClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey());
}

// Server-only client: service-role key, bypasses row-level security.
// Use only in route handlers, Inngest functions and scripts; never import into a client component.
export function serviceClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
