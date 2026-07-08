# Shopper — Retail Arbitrage Calculator

A web app for checking whether a retail arbitrage flip is worth it: enter what
you'd pay at Home Depot, Target, or Walmart, and what it sells for on Amazon
or eBay, and get a fee-aware profit breakdown and a buy / marginal / avoid
verdict. Every saved check is kept in a local history so you can build up a
list of good flips.

## Why this doesn't auto-scrape prices

Home Depot, Target, Walmart, and Amazon don't offer free, public,
individual-developer product-price APIs, and scraping their storefronts
directly generally violates their Terms of Service. So this app is built
around **manual price entry** for those four, which is fast (a few seconds
per item) and carries no ToS/legal risk. eBay is the exception — it has an
official public [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html),
which this app calls directly to suggest a real, current sell price.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Data is stored in a
local SQLite file at `data/shopper.db` (created automatically, gitignored).

### Enabling the eBay price lookup (optional)

1. Create a free account at [developer.ebay.com](https://developer.ebay.com/)
   and create an application to get a **Production** Client ID / Client
   Secret (the Browse API also works against the free Sandbox for testing).
2. Set these environment variables (e.g. in a local `.env.local` file):

   ```
   EBAY_CLIENT_ID=your-client-id
   EBAY_CLIENT_SECRET=your-client-secret
   # EBAY_ENV=sandbox   # optional, defaults to production
   ```

3. Restart the dev server. On the New Check page, switching the marketplace
   to "eBay" reveals a search box that hits `/api/ebay/search` and lets you
   pull in the median active-listing price with one click.

Without these vars set, the rest of the app works fine — you just enter the
eBay sell price manually instead of looking it up.

## How the math works

The core logic lives in `src/lib/pricing.ts` (pure functions, no I/O, so it's
easy to read and adjust):

**Cost side:** store price × quantity, plus sales tax (%), plus any shipping
you paid to acquire the item, plus other costs (packaging, mileage, etc).

**Revenue side:** sell price × quantity, minus marketplace fees:

- **Amazon:** category-based referral fee % (editable per listing — defaults
  live in `AMAZON_CATEGORY_FEES`), a flat FBA fulfillment fee estimate
  (`AMAZON_DEFAULT_FBA_FULFILLMENT_FEE`, overridable), and Amazon's $0.99
  per-item fee if you're on the Individual selling plan.
- **eBay:** a final value fee % of the sale price plus a fixed per-order fee
  (defaults in `EBAY_DEFAULT_FINAL_VALUE_FEE_PERCENT` /
  `EBAY_DEFAULT_PER_ORDER_FEE`), both editable per listing.
- **Other:** a fully manual fee % and fixed fee, for any other marketplace.
- Plus outbound shipping to the buyer, if you're not using FBA.

**Verdict:** `netProfit = netProceeds - totalCost`. The verdict combines ROI%
(profit relative to cash outlay) with a profit-per-unit floor, so a listing
with a flashy ROI% on 50 cents of actual profit gets flagged as MARGINAL
rather than BUY — thin margins get wiped out by a single return or a price
drop.

| Verdict | Meaning |
|---|---|
| STRONG BUY | ROI ≥ 30%, meaningful profit per unit |
| BUY | ROI ≥ 15%, meaningful profit per unit |
| MARGINAL | Profitable but thin (low ROI or < $2/unit profit) |
| AVOID | Net loss after fees, shipping, and tax |

All fee defaults are editable per-check in the form — they're realistic
starting points, not guarantees, since real fees vary by category, size
tier, and account status. Double check against the marketplace's current
fee schedule before relying on this for a large purchase.

## Project structure

- `src/lib/pricing.ts` — fee/margin calculation engine
- `src/lib/db.ts` — SQLite persistence (better-sqlite3)
- `src/lib/ebay.ts` — eBay Browse API client (OAuth + search)
- `src/app/api/checks` — REST API for saving/listing/deleting price checks
- `src/app/api/ebay/search` — eBay lookup endpoint
- `src/app/page.tsx` + `src/components/CheckForm.tsx` — New Check form
- `src/app/history/page.tsx` — saved history with filtering
