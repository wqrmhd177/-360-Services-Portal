import { createSupabaseClient } from "@/lib/supabaseClient";

export async function nextMovementNumber(): Promise<string> {
  const supabase = createSupabaseClient();
  const year = new Date().getFullYear();
  const start = `${year}-01-01T00:00:00.000Z`;

  const { count, error } = await supabase
    .from("movement_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start);

  if (error) {
    throw new Error(error.message);
  }

  const seq = (count ?? 0) + 1;
  return `MR-${year}-${String(seq).padStart(4, "0")}`;
}
