import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/session";

const METABASE_PUBLIC_URL =
  "https://zambeel.metabaseapp.com/public/question/050ce5ce-ce25-41e9-b34a-819933ec0235.json";

type MetabaseInventoryRow = {
  sku: string;
  quantity: number;
  warehouse_name: string;
  warehouse_id?: number | null;
  variant_id?: number | null;
};

function normalizeSku(input: string): string {
  return input.trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  const session = getPortalSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawSku = request.nextUrl.searchParams.get("sku") || "";
    const normalizedSku = normalizeSku(rawSku);
    if (!normalizedSku) {
      return NextResponse.json(
        { error: "sku query parameter is required" },
        { status: 400 }
      );
    }

    const prefix4 = normalizedSku.slice(0, 4);
    const prefix3 = normalizedSku.slice(0, 3);

    const response = await fetch(METABASE_PUBLIC_URL, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch Metabase inventory feed" },
        { status: 502 }
      );
    }

    const json = await response.json();

    // Metabase public questions return either a flat array (custom endpoint)
    // or the standard { data: { rows: [], cols: [] } } envelope.
    let rows: MetabaseInventoryRow[] = [];
    if (Array.isArray(json)) {
      rows = json as MetabaseInventoryRow[];
    } else if (
      json?.data?.rows &&
      Array.isArray(json.data.rows) &&
      json?.data?.cols &&
      Array.isArray(json.data.cols)
    ) {
      const cols: { name: string }[] = json.data.cols;
      rows = (json.data.rows as unknown[][]).map((r) =>
        Object.fromEntries(cols.map((c, i) => [c.name, r[i]]))
      ) as MetabaseInventoryRow[];
    }

    const byPrefix4 = rows.filter((row) =>
      String(row.sku || "").toUpperCase().startsWith(prefix4)
    );
    const prefixMatches =
      byPrefix4.length > 0
        ? byPrefix4
        : rows.filter((row) =>
            String(row.sku || "").toUpperCase().startsWith(prefix3)
          );

    const finalMatches = prefixMatches.filter((row) => Number(row.quantity) > 0);

    return NextResponse.json({
      normalizedSku,
      matchedPrefix:
        byPrefix4.length > 0
          ? prefix4
          : prefixMatches.length > 0
            ? prefix3
            : null,
      matches: finalMatches,
    });
  } catch (error) {
    console.error("Error in product availability inventory lookup route:", error);
    return NextResponse.json(
      { error: "Unexpected error fetching inventory" },
      { status: 500 }
    );
  }
}
