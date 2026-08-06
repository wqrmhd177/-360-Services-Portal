import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";
import {
  fetchMergedProductUpdates,
  processProductUpdateAction,
} from "@/lib/productListing/productUpdatesServer";

export async function GET(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get("tab") ?? "pending") as
      | "pending"
      | "approved"
      | "rejected"
      | "all";
    const requests = await fetchMergedProductUpdates(tab);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("product-updates GET:", error);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action as "approve" | "reject";
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const ok = await processProductUpdateAction(action, body.request, session.email);
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("product-updates POST:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
