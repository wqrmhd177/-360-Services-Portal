import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr } from "@/types/workflows";
import FinancePRTable from "./FinancePRTable";

async function getFinancePRs(session: any) {
  const supabase = createSupabaseClient();

  // Finance users only see approved PRs, Admin sees all
  let prQuery = supabase
    .from("pr")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  
  if (!session.isAdmin) {
    prQuery = prQuery.eq("approval_status", "approved");
  }

  const { data: prs } = await prQuery;

  return (prs ?? []) as Pr[];
}

export default async function FinancePurchaseRequestsPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const prs = await getFinancePRs(session);

  return <FinancePRTable prs={prs} />;
}
