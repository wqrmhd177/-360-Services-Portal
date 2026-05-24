import { NextResponse } from "next/server";

// Legacy route from Google auth flow. Now just redirect to login.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/auth/login", request.url));
}

