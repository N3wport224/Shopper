import { NextRequest, NextResponse } from "next/server";
import { calculateArbitrage, type ArbitrageInput } from "@/lib/pricing";
import { listChecks, saveCheck } from "@/lib/db";

export async function GET() {
  return NextResponse.json(listChecks());
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const productName = String(body.productName ?? "").trim();
  if (!productName) {
    return NextResponse.json({ error: "productName is required" }, { status: 400 });
  }
  if (!body.sourceStore || !body.marketplace) {
    return NextResponse.json(
      { error: "sourceStore and marketplace are required" },
      { status: 400 }
    );
  }

  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "number" ? v : parseFloat(v as string);
    return Number.isFinite(n) ? n : fallback;
  };

  const input: ArbitrageInput = {
    quantity: Math.max(1, Math.round(num(body.quantity, 1))),
    sourceStore: body.sourceStore,
    sourcePricePerUnit: num(body.sourcePricePerUnit),
    sourceTaxRatePercent: num(body.sourceTaxRatePercent),
    sourceShippingTotal: num(body.sourceShippingTotal),
    otherAcquisitionCosts: num(body.otherAcquisitionCosts),
    marketplace: body.marketplace,
    sellPricePerUnit: num(body.sellPricePerUnit),
    amazonCategory: body.amazonCategory || undefined,
    amazonPlan: body.amazonPlan || undefined,
    amazonFulfillmentFeePerUnit:
      body.amazonFulfillmentFeePerUnit !== undefined && body.amazonFulfillmentFeePerUnit !== ""
        ? num(body.amazonFulfillmentFeePerUnit)
        : undefined,
    ebayFinalValueFeePercent:
      body.ebayFinalValueFeePercent !== undefined && body.ebayFinalValueFeePercent !== ""
        ? num(body.ebayFinalValueFeePercent)
        : undefined,
    ebayPerOrderFee:
      body.ebayPerOrderFee !== undefined && body.ebayPerOrderFee !== ""
        ? num(body.ebayPerOrderFee)
        : undefined,
    manualFeePercent:
      body.manualFeePercent !== undefined && body.manualFeePercent !== ""
        ? num(body.manualFeePercent)
        : undefined,
    manualFixedFeePerOrder:
      body.manualFixedFeePerOrder !== undefined && body.manualFixedFeePerOrder !== ""
        ? num(body.manualFixedFeePerOrder)
        : undefined,
    outboundShippingPerUnit: num(body.outboundShippingPerUnit),
  };

  const result = calculateArbitrage(input);
  const saved = saveCheck({ ...input, productName, notes: body.notes || undefined }, result);

  return NextResponse.json(saved, { status: 201 });
}
