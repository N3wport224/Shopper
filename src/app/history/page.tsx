"use client";

import { useEffect, useMemo, useState } from "react";
import type { SavedCheck } from "@/lib/db";
import type { VerdictLabel } from "@/lib/pricing";
import { formatCurrency, formatPercent } from "@/lib/format";
import VerdictBadge from "@/components/VerdictBadge";

const FILTERS: Array<VerdictLabel | "ALL"> = ["ALL", "STRONG BUY", "BUY", "MARGINAL", "AVOID"];

export default function HistoryPage() {
  const [checks, setChecks] = useState<SavedCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerdictLabel | "ALL">("ALL");

  useEffect(() => {
    fetch("/api/checks")
      .then((res) => res.json())
      .then(setChecks)
      .catch(() => setError("Failed to load history"));
  }, []);

  async function handleDelete(id: number) {
    if (!checks) return;
    const prev = checks;
    setChecks(checks.filter((c) => c.id !== id));
    const res = await fetch(`/api/checks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setChecks(prev);
      setError("Failed to delete check");
    }
  }

  const filtered = useMemo(() => {
    if (!checks) return null;
    if (filter === "ALL") return checks;
    return checks.filter((c) => c.verdictLabel === filter);
  }, [checks, filter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">History</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Past price checks, saved with the fees and verdict computed at the time.
      </p>

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium border ${
              filter === f
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
                : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!filtered && !error && <p className="text-zinc-500">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="text-zinc-500">No saved checks yet. Go run a New Check.</p>
      )}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium text-right">Cost</th>
                <th className="px-3 py-2 font-medium text-right">Sell</th>
                <th className="px-3 py-2 font-medium text-right">Net profit</th>
                <th className="px-3 py-2 font-medium text-right">Margin</th>
                <th className="px-3 py-2 font-medium text-right">ROI</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{c.productName}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                    {c.sourceStore} → {c.marketplace}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(c.totalCost)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(c.grossRevenue)}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      c.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(c.netProfit)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatPercent(c.marginPercent)}</td>
                  <td className="px-3 py-2 text-right">{formatPercent(c.roiPercent)}</td>
                  <td className="px-3 py-2">
                    <VerdictBadge label={c.verdictLabel as VerdictLabel} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-zinc-400 hover:text-red-600"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
