import { NextRequest, NextResponse } from "next/server";
import { isEbayConfigured, searchEbayPrices } from "@/lib/ebay";

export async function GET(request: NextRequest) {
  if (!isEbayConfigured()) {
    return NextResponse.json(
      {
        error:
          "eBay lookup is not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET env vars to enable it.",
      },
      { status: 400 }
    );
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query || !query.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const result = await searchEbayPrices(query.trim());
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "eBay search failed" },
      { status: 502 }
    );
  }
}
