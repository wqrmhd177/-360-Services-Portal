import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";
import { cookies } from "next/headers";

type SearchType = "qr" | "pr" | "po";

function normalizeNumber(type: SearchType, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  const prefix = type === "qr" ? "QR-" : type === "pr" ? "PR-" : "PO-";
  if (upper.startsWith(prefix) || upper === prefix.replace("-", "")) {
    const suffix = trimmed.replace(/^[A-Za-z-]+/i, "").trim() || "0";
    const digits = suffix.replace(/\D/g, "") || "0";
    const num = digits.replace(/^0+/, "") || "0";
    // QR is stored with 3-digit padding (e.g. QR-019) to match growth/qr/create
    if (type === "qr") return `QR-${num.padStart(3, "0")}`;
    if (type === "pr") return `PR-${num.padStart(3, "0")}`;
    return `PO-${num.padStart(3, "0")}`;
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return trimmed;
  const num = digitsOnly.replace(/^0+/, "") || "0";
  switch (type) {
    case "qr":
      return `QR-${num.padStart(3, "0")}`;
    case "pr":
      return `PR-${num.padStart(3, "0")}`;
    case "po":
      return `PO-${num.padStart(3, "0")}`;
    default:
      return trimmed;
  }
}

export async function GET(request: Request) {
  const cookie = cookies().get("portal_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as SearchType | null;
  const number = searchParams.get("number")?.trim();

  if (!type || !number) {
    return NextResponse.json(
      { error: "Missing type or number. Use ?type=qr|pr|po&number=..." },
      { status: 400 }
    );
  }

  if (type !== "qr" && type !== "pr" && type !== "po") {
    return NextResponse.json(
      { error: "Invalid type. Use qr, pr, or po." },
      { status: 400 }
    );
  }

  const normalized = normalizeNumber(type, number);
  if (!normalized) {
    return NextResponse.json(
      { error: "Please enter a valid number." },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseClient();

    if (type === "qr") {
      const { data, error } = await supabase
        .from("qr")
        .select("id")
        .eq("qr_number", normalized)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "No QR found with this number." }, { status: 404 });
      return NextResponse.json({ id: data.id, type: "qr" });
    }

    if (type === "pr") {
      const { data, error } = await supabase
        .from("pr")
        .select("id")
        .eq("pr_number", normalized)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "No PR found with this number." }, { status: 404 });
      return NextResponse.json({ id: data.id, type: "pr" });
    }

    const { data, error } = await supabase
      .from("po")
      .select("id")
      .eq("po_number", normalized)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No PO found with this number." }, { status: 404 });
    return NextResponse.json({ id: data.id, type: "po" });
  } catch (err) {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
