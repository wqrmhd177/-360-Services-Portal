import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import type { Pr, Po } from "@/types/workflows";
import FinancePRTableWithModal from "./FinancePRTableWithModal";

async function getFinanceHistory(session: any) {
  const supabase = createSupabaseClient();

  // Finance users only see approved PRs, Admin sees all
  let prQuery = supabase
    .from("pr")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  
  if (!session.isAdmin) {
    prQuery = prQuery.eq("approval_status", "approved").neq("pr_status", "awaiting_payment");
  }

  const [{ data: prs }, { data: pos }] = await Promise.all([
    prQuery,
    supabase.from("po").select("*").order("created_at", { ascending: false }).limit(100)
  ]);

  return {
    prs: (prs ?? []) as Pr[],
    pos: (pos ?? []) as Po[]
  };
}

export default async function FinanceHistoryPage() {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const { prs, pos } = await getFinanceHistory(session);

  return <FinancePRTableWithModal prs={prs} pos={pos} />;
}
