import type { VerdictLabel } from "@/lib/pricing";

const STYLES: Record<VerdictLabel, string> = {
  "STRONG BUY": "bg-emerald-600 text-white",
  BUY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  MARGINAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  AVOID: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function VerdictBadge({ label }: { label: VerdictLabel }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${STYLES[label]}`}
    >
      {label}
    </span>
  );
}
