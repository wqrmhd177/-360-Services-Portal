import { createSupabaseClient } from "./supabaseClient";

/**
 * Get user's full name from their email address
 * Falls back to email if name is not found
 */
export async function getUserName(email: string | null | undefined): Promise<string> {
  if (!email) return "Unknown";

  try {
    const supabase = createSupabaseClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", email)
      .single();

    return profile?.full_name || email.split("@")[0]; // Fallback to email username part
  } catch (error) {
    console.error("Error fetching user name:", error);
    return email.split("@")[0]; // Fallback to email username part
  }
}

/**
 * Get multiple user names in a single query (optimized for batch operations)
 */
export async function getUserNames(emails: string[]): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();

  try {
    const supabase = createSupabaseClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("email", emails);

    const nameMap = new Map<string, string>();
    
    emails.forEach((email) => {
      const profile = profiles?.find((p) => p.email === email);
      nameMap.set(email, profile?.full_name || email.split("@")[0]);
    });

    return nameMap;
  } catch (error) {
    console.error("Error fetching user names:", error);
    const nameMap = new Map<string, string>();
    emails.forEach((email) => {
      nameMap.set(email, email.split("@")[0]);
    });
    return nameMap;
  }
}
