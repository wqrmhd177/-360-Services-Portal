import { createSupabaseClient, createSupabaseServiceClient } from "@/lib/supabaseClient";

/** Server-side DB access (service role). Never import in client components. */
export function getSupabaseServer() {
  return createSupabaseServiceClient();
}

/** @deprecated Use getSupabaseServer() in API routes and server components. */
export function createSupabaseServerClient() {
  return createSupabaseServiceClient();
}

/** Alias for server-side reads/writes — blocks browser usage via createSupabaseClient guard. */
export { createSupabaseClient as getSupabaseForServer };
