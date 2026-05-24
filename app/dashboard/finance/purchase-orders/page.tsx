import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { getUserNames } from "@/lib/getUserName";
import type { Po } from "@/types/workflows";
import FinancePOTable from "./FinancePOTable";

async function getFinancePOs(): Promise<{ pos: Po[]; creatorNames: Record<string, string> }> {
  const supabase = createSupabaseClient();

  const { data: pos } = await supabase
    .from("po")
    .select(
      "*, pr:pr_id(id, seller_channel_name, seller_service_type, movement_type, products, created_by_email, amount)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const enrichedPos = (pos ?? []) as Po[];

  // Collect unique PR creator emails for name resolution
  const prEmails = [
    ...new Set(
      enrichedPos
        .map((po) => (po.pr as any)?.created_by_email as string | undefined)
        .filter((e): e is string => !!e)
    ),
  ];

  const namesMap = await getUserNames(prEmails);
  const creatorNames: Record<string, string> = {};
  namesMap.forEach((name, email) => {
    creatorNames[email] = name;
  });

  return { pos: enrichedPos, creatorNames };
}

export default async function FinancePurchaseOrdersPage({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const sp = searchParams ?? {};
  const initialServiceGroupFilter =
    sp.group === "zambeel" || sp.group === "wholesale" ? sp.group : "all";

  const { pos, creatorNames } = await getFinancePOs();

  return (
    <FinancePOTable
      pos={pos}
      creatorNames={creatorNames}
      initialServiceGroupFilter={initialServiceGroupFilter}
    />
  );
}
