"use server";

import { createSupabaseClient } from "@/lib/supabaseClient";

export async function updateReportingMonth(poId: string, month: string | null) {
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("po")
    .update({ reporting_month: month })
    .eq("id", poId);

  if (error) {
    throw new Error(`Failed to update reporting month: ${error.message}`);
  }
}
