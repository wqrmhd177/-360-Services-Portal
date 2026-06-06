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
    return NextResponse.json({
      session,
      buildId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  } catch {
    return NextResponse.json({ session: null });
  }
}
