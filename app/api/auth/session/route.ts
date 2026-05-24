import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { PortalSession } from "@/lib/session";

export async function GET() {
  const raw = cookies().get("portal_session")?.value;
  if (!raw) {
    return NextResponse.json({ session: null });
  }
  
  try {
    const session = JSON.parse(raw) as PortalSession;
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}
