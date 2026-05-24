import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qrNumber = searchParams.get("qr") || "QR-004";
  
  const supabase = createSupabaseClient();
  
  try {
    const { data: qr, error } = await supabase
      .from("qr")
      .select("*")
      .eq("qr_number", qrNumber)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Extract purchase details and check for imagePaths
    const purchaseDetails = qr?.purchase_details || [];
    const imageInfo = purchaseDetails.map((detail: any, index: number) => ({
      index,
      productName: detail.productName,
      imagePaths: detail.imagePaths || [],
      imageCount: (detail.imagePaths || []).length
    }));

    return NextResponse.json({
      qr_number: qrNumber,
      qr_id: qr?.id,
      created_at: qr?.created_at,
      purchase_details_count: purchaseDetails.length,
      image_info: imageInfo,
      total_images: imageInfo.reduce((sum: number, info: any) => sum + info.imageCount, 0),
      raw_purchase_details: purchaseDetails
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
