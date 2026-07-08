export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
