import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Server-only database client (service role).
 * Browser code must use authenticated API routes — direct DB access is blocked.
 */
export const createSupabaseClient = () => {
  if (typeof window !== "undefined") {
    throw new Error(
      "Direct Supabase access from the browser is disabled. Use authenticated API routes.",
    );
  }
  return createSupabaseServiceClient();
};

/** Server-only client that bypasses RLS. Required for all API routes and server actions. */
export const createSupabaseServiceClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
};

