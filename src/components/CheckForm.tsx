"use client";

import { useMemo, useState } from "react";
import {
  AMAZON_CATEGORY_FEES,
  AMAZON_DEFAULT_FBA_FULFILLMENT_FEE,
  AMAZON_INDIVIDUAL_PER_ITEM_FEE,
  EBAY_DEFAULT_FINAL_VALUE_FEE_PERCENT,
  EBAY_DEFAULT_PER_ORDER_FEE,
  calculateArbitrage,
  type AmazonPlan,
  type ArbitrageInput,
  type Marketplace,
  type SourceStore,
} from "@/lib/pricing";
import { formatCurrency, formatPercent } from "@/lib/format";
import VerdictBadge from "@/components/VerdictBadge";
import type { EbaySearchResult } from "@/lib/ebay";

const SOURCE_STORES: SourceStore[] = ["Home Depot", "Target", "Walmart", "Other"];
const MARKETPLACES: Marketplace[] = ["Amazon", "eBay", "Other"];
const AMAZON_CATEGORIES = Object.keys(AMAZON_CATEGORY_FEES);

function numberInputProps(value: number, setValue: (n: number) => void) {
  return {
    value: Number.isNaN(value) ? "" : value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(parseFloat(e.target.value)),
    type: "number" as const,
    step: "0.01",
  };
}

export default function CheckForm() {
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [sourceStore, setSourceStore] = useState<SourceStore>("Home Depot");
  const [sourcePricePerUnit, setSourcePricePerUnit] = useState(0);
  const [sourceTaxRatePercent, setSourceTaxRatePercent] = useState(0);
  const [sourceShippingTotal, setSourceShippingTotal] = useState(0);
  const [otherAcquisitionCosts, setOtherAcquisitionCosts] = useState(0);

  const [marketplace, setMarketplace] = useState<Marketplace>("Amazon");
  const [sellPricePerUnit, setSellPricePerUnit] = useState(0);

  const [amazonCategory, setAmazonCategory] = useState(AMAZON_CATEGORIES[0]);
  const [amazonPlan, setAmazonPlan] = useState<AmazonPlan>("Individual");
  const [amazonFulfillmentFeePerUnit, setAmazonFulfillmentFeePerUnit] = useState(
    AMAZON_DEFAULT_FBA_FULFILLMENT_FEE
  );

  const [ebayFinalValueFeePercent, setEbayFinalValueFeePercent] = useState(
    EBAY_DEFAULT_FINAL_VALUE_FEE_PERCENT
  );
  const [ebayPerOrderFee, setEbayPerOrderFee] = useState(EBAY_DEFAULT_PER_ORDER_FEE);

  const [manualFeePercent, setManualFeePercent] = useState(10);
  const [manualFixedFeePerOrder, setManualFixedFeePerOrder] = useState(0);

  const [outboundShippingPerUnit, setOutboundShippingPerUnit] = useState(0);
  const [notes, setNotes] = useState("");

  const [ebayQuery, setEbayQuery] = useState("");
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState<string | null>(null);
  const [ebayResult, setEbayResult] = useState<EbaySearchResult | null>(null);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const input: ArbitrageInput = useMemo(
    () => ({
      quantity,
      sourceStore,
      sourcePricePerUnit: sourcePricePerUnit || 0,
      sourceTaxRatePercent: sourceTaxRatePercent || 0,
      sourceShippingTotal: sourceShippingTotal || 0,
      otherAcquisitionCosts: otherAcquisitionCosts || 0,
      marketplace,
      sellPricePerUnit: sellPricePerUnit || 0,
      amazonCategory,
      amazonPlan,
      amazonFulfillmentFeePerUnit: amazonFulfillmentFeePerUnit || 0,
      ebayFinalValueFeePercent: ebayFinalValueFeePercent || 0,
      ebayPerOrderFee: ebayPerOrderFee || 0,
      manualFeePercent: marketplace === "Other" ? manualFeePercent || 0 : undefined,
      manualFixedFeePerOrder: marketplace === "Other" ? manualFixedFeePerOrder || 0 : undefined,
      outboundShippingPerUnit: outboundShippingPerUnit || 0,
    }),
    [
      quantity,
      sourceStore,
      sourcePricePerUnit,
      sourceTaxRatePercent,
      sourceShippingTotal,
      otherAcquisitionCosts,
      marketplace,
      sellPricePerUnit,
      amazonCategory,
      amazonPlan,
      amazonFulfillmentFeePerUnit,
      ebayFinalValueFeePercent,
      ebayPerOrderFee,
      manualFeePercent,
      manualFixedFeePerOrder,
      outboundShippingPerUnit,
    ]
  );

  const result = useMemo(() => calculateArbitrage(input), [input]);

  async function handleEbayLookup() {
    const q = (ebayQuery || productName).trim();
    if (!q) {
      setEbayError("Enter a product name or search term first.");
      return;
    }
    setEbayLoading(true);
    setEbayError(null);
    setEbayResult(null);
    try {
      const res = await fetch(`/api/ebay/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "eBay search failed");
      }
      setEbayResult(data);
    } catch (err) {
      setEbayError(err instanceof Error ? err.message : "eBay search failed");
    } finally {
      setEbayLoading(false);
    }
  }

  async function handleSave() {
    if (!productName.trim()) {
      setSaveState("error");
      setSaveError("Product name is required.");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, productName, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium mb-1";
  const sectionClass =
    "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">New Price Check</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Enter what you&apos;d pay in-store and what it sells for on the marketplace — fees,
        shipping, and tax are factored in automatically.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className={sectionClass}>
            <h2 className="font-semibold">Product</h2>
            <div>
              <label className={labelClass}>Product name</label>
              <input
                className={inputClass}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Milwaukee M18 Drill Kit"
              />
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input
                className={inputClass}
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Buy side (retail store)</h2>
            <div>
              <label className={labelClass}>Store</label>
              <select
                className={inputClass}
                value={sourceStore}
                onChange={(e) => setSourceStore(e.target.value as SourceStore)}
              >
                {SOURCE_STORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Price per unit ($)</label>
                <input
                  className={inputClass}
                  {...numberInputProps(sourcePricePerUnit, setSourcePricePerUnit)}
                />
              </div>
              <div>
                <label className={labelClass}>Sales tax (%)</label>
                <input
                  className={inputClass}
                  {...numberInputProps(sourceTaxRatePercent, setSourceTaxRatePercent)}
                />
              </div>
              <div>
                <label className={labelClass}>Shipping to acquire ($)</label>
                <input
                  className={inputClass}
                  {...numberInputProps(sourceShippingTotal, setSourceShippingTotal)}
                />
              </div>
              <div>
                <label className={labelClass}>Other costs ($)</label>
                <input
                  className={inputClass}
                  {...numberInputProps(otherAcquisitionCosts, setOtherAcquisitionCosts)}
                />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Sell side (marketplace)</h2>
            <div>
              <label className={labelClass}>Marketplace</label>
              <select
                className={inputClass}
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
              >
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Sell price per unit ($)</label>
              <input
                className={inputClass}
                {...numberInputProps(sellPricePerUnit, setSellPricePerUnit)}
              />
            </div>

            {marketplace === "eBay" && (
              <div className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-3 space-y-2">
                <label className={labelClass}>Look up real eBay prices</label>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder={productName || "Search term"}
                    value={ebayQuery}
                    onChange={(e) => setEbayQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleEbayLookup}
                    disabled={ebayLoading}
                    className="whitespace-nowrap rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {ebayLoading ? "Searching…" : "Search eBay"}
                  </button>
                </div>
                {ebayError && <p className="text-sm text-red-600">{ebayError}</p>}
                {ebayResult && (
                  <div className="text-sm space-y-2">
                    {ebayResult.count === 0 ? (
                      <p className="text-zinc-500">No active listings found.</p>
                    ) : (
                      <>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {ebayResult.count} listings — low {formatCurrency(ebayResult.lowPrice!)},
                          median {formatCurrency(ebayResult.medianPrice!)}, high{" "}
                          {formatCurrency(ebayResult.highPrice!)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSellPricePerUnit(ebayResult.medianPrice!)}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Use median price ({formatCurrency(ebayResult.medianPrice!)})
                        </button>
                        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                          {ebayResult.items.slice(0, 5).map((item, i) => (
                            <li key={i} className="py-1.5 flex justify-between gap-3">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:underline"
                              >
                                {item.title}
                              </a>
                              <span className="whitespace-nowrap font-medium">
                                {formatCurrency(item.price)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {marketplace === "Amazon" && (
              <>
                <div>
                  <label className={labelClass}>Category (sets referral fee %)</label>
                  <select
                    className={inputClass}
                    value={amazonCategory}
                    onChange={(e) => setAmazonCategory(e.target.value)}
                  >
                    {AMAZON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c} ({AMAZON_CATEGORY_FEES[c]}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Selling plan</label>
                    <select
                      className={inputClass}
                      value={amazonPlan}
                      onChange={(e) => setAmazonPlan(e.target.value as AmazonPlan)}
                    >
                      <option value="Individual">
                        Individual (+{formatCurrency(AMAZON_INDIVIDUAL_PER_ITEM_FEE)}/item)
                      </option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>FBA fulfillment fee ($/unit)</label>
                    <input
                      className={inputClass}
                      {...numberInputProps(
                        amazonFulfillmentFeePerUnit,
                        setAmazonFulfillmentFeePerUnit
                      )}
                    />
                  </div>
                </div>
              </>
            )}

            {marketplace === "eBay" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Final value fee (%)</label>
                  <input
                    className={inputClass}
                    {...numberInputProps(ebayFinalValueFeePercent, setEbayFinalValueFeePercent)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Per-order fee ($)</label>
                  <input
                    className={inputClass}
                    {...numberInputProps(ebayPerOrderFee, setEbayPerOrderFee)}
                  />
                </div>
              </div>
            )}

            {marketplace === "Other" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Marketplace fee (%)</label>
                  <input
                    className={inputClass}
                    {...numberInputProps(manualFeePercent, setManualFeePercent)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Fixed fee per order ($)</label>
                  <input
                    className={inputClass}
                    {...numberInputProps(manualFixedFeePerOrder, setManualFixedFeePerOrder)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={labelClass}>Shipping to buyer ($/unit)</label>
              <input
                className={inputClass}
                {...numberInputProps(outboundShippingPerUnit, setOutboundShippingPerUnit)}
              />
            </div>
          </div>

          <div className={sectionClass}>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              className={inputClass}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:sticky lg:top-6 h-fit space-y-6">
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Verdict</h2>
              <VerdictBadge label={result.verdict.label} />
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {result.verdict.explanation}
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <div>
                <p className="text-xs text-zinc-500">Net profit</p>
                <p
                  className={`text-lg font-semibold ${result.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatCurrency(result.netProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Margin</p>
                <p className="text-lg font-semibold">{formatPercent(result.marginPercent)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">ROI</p>
                <p className="text-lg font-semibold">{formatPercent(result.roiPercent)}</p>
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Cost breakdown</h2>
            <table className="w-full text-sm">
              <tbody>
                {result.costBreakdown.map((row) => (
                  <tr key={row.label} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{row.label}</td>
                    <td className="py-1.5 text-right font-medium">
                      {formatCurrency(row.amountTotal)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2 font-semibold">Total cost</td>
                  <td className="pt-2 text-right font-semibold">
                    {formatCurrency(result.totalCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={sectionClass}>
            <h2 className="font-semibold">Marketplace fees</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 text-zinc-600 dark:text-zinc-400">Gross revenue</td>
                  <td className="py-1.5 text-right font-medium">
                    {formatCurrency(result.grossRevenue)}
                  </td>
                </tr>
                {result.feeBreakdown.map((row) => (
                  <tr key={row.label} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">-{row.label}</td>
                    <td className="py-1.5 text-right font-medium text-red-600">
                      -{formatCurrency(row.amountTotal)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2 font-semibold">Net proceeds</td>
                  <td className="pt-2 text-right font-semibold">
                    {formatCurrency(result.netProceeds)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save to history"}
            </button>
            {saveState === "saved" && (
              <p className="text-sm text-emerald-600">Saved! View it in History.</p>
            )}
            {saveState === "error" && <p className="text-sm text-red-600">{saveError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
