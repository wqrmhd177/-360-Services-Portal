import { redirect } from "next/navigation";

export default async function FinancePoPaymentsIndexPage() {
  redirect("/dashboard/finance/po-payments/supplier");
}
