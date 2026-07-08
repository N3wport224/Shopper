import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { ArbitrageInput, ArbitrageResult } from "./pricing";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Reuse a single connection across Next.js dev hot-reloads.
declare global {
  var __shopperDb: Database.Database | undefined;
}

const db = global.__shopperDb ?? new Database(path.join(dataDir, "shopper.db"));
if (process.env.NODE_ENV !== "production") {
  global.__shopperDb = db;
}

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productName TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    sourceStore TEXT NOT NULL,
    sourcePricePerUnit REAL NOT NULL,
    sourceTaxRatePercent REAL NOT NULL,
    sourceShippingTotal REAL NOT NULL,
    otherAcquisitionCosts REAL NOT NULL,
    marketplace TEXT NOT NULL,
    sellPricePerUnit REAL NOT NULL,
    amazonCategory TEXT,
    amazonPlan TEXT,
    amazonFulfillmentFeePerUnit REAL,
    ebayFinalValueFeePercent REAL,
    ebayPerOrderFee REAL,
    manualFeePercent REAL,
    manualFixedFeePerOrder REAL,
    outboundShippingPerUnit REAL NOT NULL,
    notes TEXT,
    totalCost REAL NOT NULL,
    grossRevenue REAL NOT NULL,
    totalFees REAL NOT NULL,
    netProfit REAL NOT NULL,
    marginPercent REAL NOT NULL,
    roiPercent REAL NOT NULL,
    verdictLabel TEXT NOT NULL,
    resultJson TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

export interface SavedCheck {
  id: number;
  productName: string;
  quantity: number;
  sourceStore: string;
  sourcePricePerUnit: number;
  sourceTaxRatePercent: number;
  sourceShippingTotal: number;
  otherAcquisitionCosts: number;
  marketplace: string;
  sellPricePerUnit: number;
  amazonCategory: string | null;
  amazonPlan: string | null;
  amazonFulfillmentFeePerUnit: number | null;
  ebayFinalValueFeePercent: number | null;
  ebayPerOrderFee: number | null;
  manualFeePercent: number | null;
  manualFixedFeePerOrder: number | null;
  outboundShippingPerUnit: number;
  notes: string | null;
  totalCost: number;
  grossRevenue: number;
  totalFees: number;
  netProfit: number;
  marginPercent: number;
  roiPercent: number;
  verdictLabel: string;
  resultJson: string;
  createdAt: string;
}

const insertStmt = db.prepare(`
  INSERT INTO checks (
    productName, quantity, sourceStore, sourcePricePerUnit, sourceTaxRatePercent,
    sourceShippingTotal, otherAcquisitionCosts, marketplace, sellPricePerUnit,
    amazonCategory, amazonPlan, amazonFulfillmentFeePerUnit,
    ebayFinalValueFeePercent, ebayPerOrderFee, manualFeePercent, manualFixedFeePerOrder,
    outboundShippingPerUnit, notes,
    totalCost, grossRevenue, totalFees, netProfit, marginPercent, roiPercent, verdictLabel,
    resultJson, createdAt
  ) VALUES (
    @productName, @quantity, @sourceStore, @sourcePricePerUnit, @sourceTaxRatePercent,
    @sourceShippingTotal, @otherAcquisitionCosts, @marketplace, @sellPricePerUnit,
    @amazonCategory, @amazonPlan, @amazonFulfillmentFeePerUnit,
    @ebayFinalValueFeePercent, @ebayPerOrderFee, @manualFeePercent, @manualFixedFeePerOrder,
    @outboundShippingPerUnit, @notes,
    @totalCost, @grossRevenue, @totalFees, @netProfit, @marginPercent, @roiPercent, @verdictLabel,
    @resultJson, @createdAt
  )
`);

export function saveCheck(
  input: ArbitrageInput & { productName: string; notes?: string },
  result: ArbitrageResult
): SavedCheck {
  const row = {
    productName: input.productName,
    quantity: result.quantity,
    sourceStore: input.sourceStore,
    sourcePricePerUnit: input.sourcePricePerUnit,
    sourceTaxRatePercent: input.sourceTaxRatePercent,
    sourceShippingTotal: input.sourceShippingTotal,
    otherAcquisitionCosts: input.otherAcquisitionCosts,
    marketplace: input.marketplace,
    sellPricePerUnit: input.sellPricePerUnit,
    amazonCategory: input.amazonCategory ?? null,
    amazonPlan: input.amazonPlan ?? null,
    amazonFulfillmentFeePerUnit: input.amazonFulfillmentFeePerUnit ?? null,
    ebayFinalValueFeePercent: input.ebayFinalValueFeePercent ?? null,
    ebayPerOrderFee: input.ebayPerOrderFee ?? null,
    manualFeePercent: input.manualFeePercent ?? null,
    manualFixedFeePerOrder: input.manualFixedFeePerOrder ?? null,
    outboundShippingPerUnit: input.outboundShippingPerUnit,
    notes: input.notes ?? null,
    totalCost: result.totalCost,
    grossRevenue: result.grossRevenue,
    totalFees: result.totalFees,
    netProfit: result.netProfit,
    marginPercent: result.marginPercent,
    roiPercent: result.roiPercent,
    verdictLabel: result.verdict.label,
    resultJson: JSON.stringify(result),
    createdAt: new Date().toISOString(),
  };

  const info = insertStmt.run(row);
  return getCheck(Number(info.lastInsertRowid))!;
}

export function listChecks(): SavedCheck[] {
  return db.prepare("SELECT * FROM checks ORDER BY id DESC").all() as SavedCheck[];
}

export function getCheck(id: number): SavedCheck | undefined {
  return db.prepare("SELECT * FROM checks WHERE id = ?").get(id) as SavedCheck | undefined;
}

export function deleteCheck(id: number): void {
  db.prepare("DELETE FROM checks WHERE id = ?").run(id);
}
