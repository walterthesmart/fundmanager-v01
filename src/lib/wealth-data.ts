
import { prisma } from "@/lib/prisma";
import type { Client, Product, ClientHolding, CashTransaction, PriceHistory, Notification } from "@prisma/client";

export type { Client, Product, ClientHolding as Holding, CashTransaction, PriceHistory, Notification };

export const ASSET_CLASSES = [
  { value: "global_equity", label: "Global Equity" },
  { value: "local_equity", label: "Local Equity" },
  { value: "global_fixed_income", label: "Global Fixed Income" },
  { value: "local_fixed_income", label: "Local Fixed Income" },
  { value: "money_market", label: "Money Market" },
  { value: "real_estate", label: "Real Estate" },
  { value: "alternatives", label: "Alternatives" },
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number]["value"];

export const assetClassLabel = (value: string) =>
  ASSET_CLASSES.find((a) => a.value === value)?.label ?? value;

export async function getClients() {
  return await prisma.client.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function getProducts() {
  return await prisma.product.findMany({
    orderBy: [
      { asset_class: 'asc' },
      { name: 'asc' }
    ]
  });
}

export async function getClientHoldings(clientId?: string) {
  if (clientId) {
    return await prisma.clientHolding.findMany({
      where: { client_id: clientId }
    });
  }
  return await prisma.clientHolding.findMany();
}

export async function getCashTransactions(clientId?: string) {
  if (clientId) {
    return await prisma.cashTransaction.findMany({
      where: { client_id: clientId },
      orderBy: { submitted_at: 'desc' }
    });
  }
  return await prisma.cashTransaction.findMany({
    orderBy: { submitted_at: 'desc' }
  });
}

export async function getPriceHistory(productId?: string) {
  if (productId) {
    return await prisma.priceHistory.findMany({
      where: { product_id: productId },
      orderBy: { occurred_at: 'desc' },
      take: 200
    });
  }
  return await prisma.priceHistory.findMany({
    orderBy: { occurred_at: 'desc' },
    take: 200
  });
}

export async function getNotifications() {
  return await prisma.notification.findMany({
    orderBy: { created_at: 'desc' },
    take: 50
  });
}

export type ValuedHolding = {
  holding: ClientHolding;
  product: Product;
  marketValue: number;
  cost: number;
  gain: number;
  gainPct: number;
};

export function valueHoldings(holdings: ClientHolding[], products: Product[]): ValuedHolding[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return holdings.flatMap((holding) => {
    const product = byId.get(holding.product_id);
    if (!product) return [];
    const units = Number(holding.units);
    const marketValue = units * Number(product.price);
    const cost = units * Number(holding.avg_cost);
    const gain = marketValue - cost;
    return [
      {
        holding,
        product,
        marketValue,
        cost,
        gain,
        gainPct: cost > 0 ? (gain / cost) * 100 : 0,
      },
    ];
  });
}

export function clientAum(clientId: string, holdings: ClientHolding[], products: Product[]) {
  return valueHoldings(
    holdings.filter((h) => h.client_id === clientId),
    products,
  ).reduce((sum, v) => sum + v.marketValue, 0);
}

export function matchClient(row: { identifier?: string; name?: string }, clients: Client[]) {
  const ident = (row.identifier ?? "").trim().toLowerCase();
  if (ident) {
    const byIdent = clients.find((c) => c.identifier.toLowerCase() === ident);
    if (byIdent) return { client: byIdent, confidence: "exact-id" as const };
  }
  const name = (row.name ?? "").trim().toLowerCase();
  if (!name) return { client: null, confidence: "none" as const };

  const exact = clients.find((c) => c.name.toLowerCase() === name);
  if (exact) return { client: exact, confidence: "exact-name" as const };

  const partial = clients.filter(
    (c) => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()),
  );
  if (partial.length === 1 && partial[0]) return { client: partial[0], confidence: "partial" as const };

  const tokens = name.split(/\s+/).filter((t) => t.length > 2);
  const scored = clients
    .map((c) => {
      const target = c.name.toLowerCase();
      return { c, score: tokens.filter((t) => target.includes(t)).length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && (scored.length === 1 || best.score > (scored[1]?.score ?? 0)))
    return { client: best.c, confidence: "fuzzy" as const };

  return { client: null, confidence: "none" as const };
}
