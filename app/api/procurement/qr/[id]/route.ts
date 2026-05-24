import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { cookies } from "next/headers";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get("portal_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("qr").select("*").eq("id", params.id).maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "QR not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch QR" }, { status: 500 });
  }
}
