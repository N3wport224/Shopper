// Core arbitrage math: turns raw store/marketplace prices into a fee-aware
// profit breakdown and a buy/no-buy verdict. Kept UI- and DB-free so it can
// be unit tested and reused from both API routes and the client form.

export type SourceStore = "Home Depot" | "Target" | "Walmart" | "Other";
export type Marketplace = "Amazon" | "eBay" | "Other";
export type AmazonPlan = "Individual" | "Professional";

// Amazon referral fee % by category (2024 published rates, common categories).
// "Other / Not sure" falls back to the most common default rate.
export const AMAZON_CATEGORY_FEES: Record<string, number> = {
  "Tools & Home Improvement": 15,
  "Home & Kitchen": 15,
  "Toys & Games": 15,
  Electronics: 8,
  "Cell Phones & Accessories": 8,
  "Grocery & Gourmet Food": 8,
  "Beauty & Personal Care": 8,
  "Clothing & Accessories": 17,
  "Sports & Outdoors": 15,
  "Office Products": 15,
  "Pet Supplies": 15,
  "Video Games": 15,
  Books: 15,
  "Other / Not sure": 15,
};

export const EBAY_DEFAULT_FINAL_VALUE_FEE_PERCENT = 13.25;
export const EBAY_DEFAULT_PER_ORDER_FEE = 0.4;
export const AMAZON_DEFAULT_FBA_FULFILLMENT_FEE = 8.0;
export const AMAZON_INDIVIDUAL_PER_ITEM_FEE = 0.99;

export interface ArbitrageInput {
  quantity: number;

  // Acquisition (buy) side
  sourceStore: SourceStore;
  sourcePricePerUnit: number;
  sourceTaxRatePercent: number;
  sourceShippingTotal: number;
  otherAcquisitionCosts: number;

  // Sale side
  marketplace: Marketplace;
  sellPricePerUnit: number;

  // Amazon-specific inputs (ignored unless marketplace === "Amazon")
  amazonCategory?: string;
  amazonPlan?: AmazonPlan;
  amazonFulfillmentFeePerUnit?: number;

  // eBay-specific inputs (ignored unless marketplace === "eBay")
  ebayFinalValueFeePercent?: number;
  ebayPerOrderFee?: number;

  // "Other" marketplace / manual override, also used to override eBay/Amazon
  // computed fee if the user wants to type in a known flat fee instead.
  manualFeePercent?: number;
  manualFixedFeePerOrder?: number;

  // Cost the seller pays to ship the item to the buyer (0 if buyer pays
  // separately or it's baked into an FBA fulfillment fee).
  outboundShippingPerUnit: number;
}

export interface FeeLineItem {
  label: string;
  amountPerUnit: number;
  amountTotal: number;
}

export interface ArbitrageResult {
  quantity: number;

  totalCost: number;
  costPerUnit: number;
  costBreakdown: FeeLineItem[];

  grossRevenue: number;
  totalFees: number;
  feeBreakdown: FeeLineItem[];

  netProceeds: number;
  netProfit: number;
  netProfitPerUnit: number;

  marginPercent: number; // net profit / gross revenue
  roiPercent: number; // net profit / total cost

  verdict: Verdict;
}

export type VerdictLabel = "STRONG BUY" | "BUY" | "MARGINAL" | "AVOID";

export interface Verdict {
  label: VerdictLabel;
  explanation: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getAmazonReferralFeePercent(category: string | undefined): number {
  if (!category) return AMAZON_CATEGORY_FEES["Other / Not sure"];
  return AMAZON_CATEGORY_FEES[category] ?? AMAZON_CATEGORY_FEES["Other / Not sure"];
}

export function calculateArbitrage(input: ArbitrageInput): ArbitrageResult {
  const quantity = Math.max(1, input.quantity || 1);

  // ---- Cost side ----
  const sourceSubtotal = input.sourcePricePerUnit * quantity;
  const tax = sourceSubtotal * ((input.sourceTaxRatePercent || 0) / 100);
  const shipping = input.sourceShippingTotal || 0;
  const otherCosts = input.otherAcquisitionCosts || 0;

  const costBreakdown: FeeLineItem[] = [
    {
      label: `${input.sourceStore} price (${quantity} x $${input.sourcePricePerUnit.toFixed(2)})`,
      amountPerUnit: input.sourcePricePerUnit,
      amountTotal: round2(sourceSubtotal),
    },
    {
      label: `Sales tax (${input.sourceTaxRatePercent || 0}%)`,
      amountPerUnit: round2(tax / quantity),
      amountTotal: round2(tax),
    },
    {
      label: "Shipping to acquire item",
      amountPerUnit: round2(shipping / quantity),
      amountTotal: round2(shipping),
    },
    {
      label: "Other acquisition costs",
      amountPerUnit: round2(otherCosts / quantity),
      amountTotal: round2(otherCosts),
    },
  ];

  const totalCost = round2(sourceSubtotal + tax + shipping + otherCosts);

  // ---- Revenue side ----
  const grossRevenue = round2(input.sellPricePerUnit * quantity);

  // ---- Fee side ----
  const feeBreakdown: FeeLineItem[] = [];

  if (input.manualFeePercent !== undefined || input.manualFixedFeePerOrder !== undefined) {
    const pct = input.manualFeePercent ?? 0;
    const fixed = input.manualFixedFeePerOrder ?? 0;
    const pctAmount = grossRevenue * (pct / 100);
    feeBreakdown.push({
      label: `Marketplace fee (${pct}%)`,
      amountPerUnit: round2(pctAmount / quantity),
      amountTotal: round2(pctAmount),
    });
    if (fixed) {
      feeBreakdown.push({
        label: "Fixed per-order fee",
        amountPerUnit: round2(fixed),
        amountTotal: round2(fixed * quantity),
      });
    }
  } else if (input.marketplace === "Amazon") {
    const referralPct = getAmazonReferralFeePercent(input.amazonCategory);
    const referralFee = grossRevenue * (referralPct / 100);
    feeBreakdown.push({
      label: `Amazon referral fee (${referralPct}% - ${input.amazonCategory ?? "Other / Not sure"})`,
      amountPerUnit: round2(referralFee / quantity),
      amountTotal: round2(referralFee),
    });

    const fulfillmentPerUnit =
      input.amazonFulfillmentFeePerUnit ?? AMAZON_DEFAULT_FBA_FULFILLMENT_FEE;
    feeBreakdown.push({
      label: "Amazon FBA fulfillment fee",
      amountPerUnit: round2(fulfillmentPerUnit),
      amountTotal: round2(fulfillmentPerUnit * quantity),
    });

    if ((input.amazonPlan ?? "Individual") === "Individual") {
      feeBreakdown.push({
        label: "Amazon per-item fee (Individual plan)",
        amountPerUnit: AMAZON_INDIVIDUAL_PER_ITEM_FEE,
        amountTotal: round2(AMAZON_INDIVIDUAL_PER_ITEM_FEE * quantity),
      });
    }
  } else if (input.marketplace === "eBay") {
    const fvfPct = input.ebayFinalValueFeePercent ?? EBAY_DEFAULT_FINAL_VALUE_FEE_PERCENT;
    const perOrderFee = input.ebayPerOrderFee ?? EBAY_DEFAULT_PER_ORDER_FEE;
    const fvfAmount = grossRevenue * (fvfPct / 100);
    feeBreakdown.push({
      label: `eBay final value fee (${fvfPct}%)`,
      amountPerUnit: round2(fvfAmount / quantity),
      amountTotal: round2(fvfAmount),
    });
    feeBreakdown.push({
      label: "eBay per-order fee",
      amountPerUnit: perOrderFee,
      amountTotal: round2(perOrderFee * quantity),
    });
  }

  const outboundShipping = (input.outboundShippingPerUnit || 0) * quantity;
  if (outboundShipping) {
    feeBreakdown.push({
      label: "Shipping to buyer",
      amountPerUnit: round2(input.outboundShippingPerUnit),
      amountTotal: round2(outboundShipping),
    });
  }

  const totalFees = round2(feeBreakdown.reduce((sum, f) => sum + f.amountTotal, 0));

  const netProceeds = round2(grossRevenue - totalFees);
  const netProfit = round2(netProceeds - totalCost);
  const netProfitPerUnit = round2(netProfit / quantity);

  const marginPercent = grossRevenue !== 0 ? round2((netProfit / grossRevenue) * 100) : 0;
  const roiPercent = totalCost !== 0 ? round2((netProfit / totalCost) * 100) : 0;

  return {
    quantity,
    totalCost,
    costPerUnit: round2(totalCost / quantity),
    costBreakdown,
    grossRevenue,
    totalFees,
    feeBreakdown,
    netProceeds,
    netProfit,
    netProfitPerUnit,
    marginPercent,
    roiPercent,
    verdict: getVerdict(netProfitPerUnit, roiPercent),
  };
}

export function getVerdict(netProfitPerUnit: number, roiPercent: number): Verdict {
  if (netProfitPerUnit <= 0) {
    return {
      label: "AVOID",
      explanation: "You'd lose money on this after fees, shipping, and tax.",
    };
  }

  // A high ROI% on a tiny profit-per-unit isn't worth the effort of sourcing,
  // listing, and shipping, so profit-per-unit acts as a floor on the verdict.
  if (netProfitPerUnit < 2) {
    return {
      label: "MARGINAL",
      explanation: "Technically profitable, but the margin per unit is too thin to be worth the effort/risk.",
    };
  }

  if (roiPercent >= 30) {
    return {
      label: "STRONG BUY",
      explanation: "Excellent return relative to cash outlay after all fees.",
    };
  }

  if (roiPercent >= 15) {
    return {
      label: "BUY",
      explanation: "Solid margin after fees, shipping, and tax.",
    };
  }

  return {
    label: "MARGINAL",
    explanation: "Profitable, but the margin is thin - price swings or return fees could wipe it out.",
  };
}
