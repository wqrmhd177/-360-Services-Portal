import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";
import { getUserNames } from "@/lib/getUserName";
import type { Pr } from "@/types/workflows";
import SellerPaymentsTable from "./SellerPaymentsTable";

async function getSellerPaymentPRs(serviceType: string, isAdmin: boolean) {
  const supabase = createSupabaseClient();

  let query = supabase
    .from("pr")
    .select("*")
    .eq("seller_service_type", serviceType)
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("approval_status", "approved").neq("pr_status", "awaiting_payment");
  }

  const { data } = await query;
  return (data ?? []) as Pr[];
}

export default async function SellerPaymentsPage({
  params,
}: {
  params: { serviceType: string };
}) {
  const session = getPortalSession();
  if (!session?.email) {
    redirect("/auth/login");
  }

  const serviceType = decodeURIComponent(params.serviceType);
  const prs = await getSellerPaymentPRs(serviceType, !!session.isAdmin);

  // Batch-resolve creator names
  const uniqueEmails = Array.from(new Set(prs.map((pr) => pr.created_by_email)));
  const nameMap = await getUserNames(uniqueEmails);

  // Convert Map to plain object for client component serialisation
  const nameMapObj: Record<string, string> = {};
  nameMap.forEach((name, email) => {
    nameMapObj[email] = name;
  });

  return (
    <SellerPaymentsTable
      prs={prs}
      serviceType={serviceType}
      nameMap={nameMapObj}
    />
  );
}
