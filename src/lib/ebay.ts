// Thin client for eBay's official Browse API (public, ToS-compliant), used
// to suggest a realistic sell price on the marketplace side of a comparison.
// Requires EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (free eBay developer account,
// "Production" keys) to be set as env vars. Falls back to a clear error if
// not configured so the rest of the app still works with manual entry.

const EBAY_ENV = process.env.EBAY_ENV === "sandbox" ? "sandbox" : "production";
const API_BASE =
  EBAY_ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
const MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || "EBAY_US";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isEbayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "eBay lookup is not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to enable it."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay OAuth token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface EbayItemSummary {
  title: string;
  price: number;
  currency: string;
  condition: string | null;
  url: string;
}

export interface EbaySearchResult {
  query: string;
  count: number;
  lowPrice: number | null;
  highPrice: number | null;
  medianPrice: number | null;
  averagePrice: number | null;
  currency: string | null;
  items: EbayItemSummary[];
}

export async function searchEbayPrices(query: string, limit = 20): Promise<EbaySearchResult> {
  const token = await getAccessToken();

  const url = new URL(`${API_BASE}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay search failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    itemSummaries?: Array<{
      title: string;
      price?: { value: string; currency: string };
      condition?: string;
      itemWebUrl: string;
    }>;
  };

  const items: EbayItemSummary[] = (data.itemSummaries ?? [])
    .filter((item) => item.price?.value)
    .map((item) => ({
      title: item.title,
      price: parseFloat(item.price!.value),
      currency: item.price!.currency,
      condition: item.condition ?? null,
      url: item.itemWebUrl,
    }));

  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const count = prices.length;

  const median =
    count === 0
      ? null
      : count % 2 === 1
        ? prices[(count - 1) / 2]
        : (prices[count / 2 - 1] + prices[count / 2]) / 2;

  const average = count === 0 ? null : prices.reduce((sum, p) => sum + p, 0) / count;

  return {
    query,
    count,
    lowPrice: count ? prices[0] : null,
    highPrice: count ? prices[count - 1] : null,
    medianPrice: median !== null ? Math.round(median * 100) / 100 : null,
    averagePrice: average !== null ? Math.round(average * 100) / 100 : null,
    currency: items[0]?.currency ?? null,
    items: items.slice(0, 10),
  };
}
