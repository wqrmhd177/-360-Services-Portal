import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { getPortalSession } from "@/lib/session";

export async function GET() {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canAccess =
    session.role === "approver" || session.role === "admin" || session.isAdmin;
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createSupabaseClient();

    const [{ data: qrs }, { data: prs }, { data: profiles }] = await Promise.all([
      supabase.from("qr").select("created_by_email"),
      supabase.from("pr").select("created_by_email"),
      supabase.from("profiles").select("email, full_name").eq("role", "growth"),
    ]);

    const emails = new Set<string>();
    (qrs ?? []).forEach((q: { created_by_email: string }) => {
      if (q.created_by_email) emails.add(q.created_by_email);
    });
    (prs ?? []).forEach((p: { created_by_email: string }) => {
      if (p.created_by_email) emails.add(p.created_by_email);
    });

    const nameMap = new Map(
      (profiles ?? []).map((p: { email: string; full_name?: string }) => [
        p.email,
        p.full_name || p.email.split("@")[0],
      ])
    );

    const creators = Array.from(emails)
      .sort()
      .map((email) => ({
        email,
        name: nameMap.get(email) || email.split("@")[0],
      }));

    return NextResponse.json(creators);
  } catch (error) {
    console.error("Failed to fetch growth creators:", error);
    return NextResponse.json({ error: "Failed to fetch creators" }, { status: 500 });
  }
}
