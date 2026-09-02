'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import yahooFinance from 'yahoo-finance2'

export async function applyPricesAction(
  updates: { id: string; price: number; mode: "manual" | "automated"; source: string | null }[],
  userId?: string
) {
  for (const update of updates) {
    const product = await prisma.product.findUnique({ where: { id: update.id } })
    if (!product) continue;

    await prisma.product.update({
      where: { id: update.id },
      data: {
        price: update.price,
        previous_price: product.price,
        price_mode: update.mode,
        price_source: update.mode === "automated" ? update.source : null,
        price_updated_at: new Date(),
      }
    });

    await prisma.priceHistory.create({
      data: {
        product_id: update.id,
        old_price: product.price,
        new_price: update.price,
        mode: update.mode,
        source: update.mode === "automated" ? update.source : null,
        changed_by: userId || null,
      }
    });
  }
  
  revalidatePath('/products')
  return updates.length;
}

export async function refreshLivePricesAction() {
  const products = await prisma.product.findMany({
    where: { price_mode: "automated", price_source: "yahoo-finance" }
  });
  
  let updatedCount = 0;
  for (const product of products) {
    try {
      // Parse ticker, handle suffix
      let ticker = product.ticker;
      if (ticker.includes('-')) {
        ticker = ticker.split('-')[1]; // e.g. SGF-IAU -> IAU
      }
      
      const quote = await yahooFinance.quote(ticker);
      if (quote && quote.regularMarketPrice) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            previous_price: product.price,
            price: quote.regularMarketPrice,
            price_updated_at: new Date()
          }
        });
        
        await prisma.priceHistory.create({
          data: {
            product_id: product.id,
            old_price: product.price,
            new_price: quote.regularMarketPrice,
            mode: "automated",
            source: "yahoo-finance"
          }
        });
        updatedCount++;
      }
    } catch (error) {
      console.error(`Failed to fetch price for ${product.ticker}:`, error);
    }
  }
  
  revalidatePath('/products');
  return updatedCount;
}

export async function fetchProductHistory(productId: string) {
  return await prisma.priceHistory.findMany({
    where: { product_id: productId },
    orderBy: { occurred_at: 'asc' },
  });
}

export async function fetchProductTransactions(productId: string) {
  return await prisma.cashTransaction.findMany({
    where: { product_id: productId },
    orderBy: { value_date: 'asc' },
    include: { client: true },
  });
}

export async function fetchSecurityTransactions(productId: string) {
  return await prisma.securityTransaction.findMany({
    where: { product_id: productId },
    orderBy: { value_date: 'asc' },
  });
}

export async function fetchInstruments(symbols: string[]) {
  return await prisma.instrument.findMany({
    where: { symbol: { in: symbols } }
  });
}

export async function upsertInstrument(data: {
  symbol: string;
  name?: string;
  market_price?: number;
  market_ytm?: number;
  face_value?: number;
  coupon_rate?: number;
  coupon_freq?: number;
  maturity_date?: string | null;
  asset_class?: string;
  currency?: string;
}) {
  const symbolUpper = data.symbol.trim().toUpperCase();
  const result = await prisma.instrument.upsert({
    where: { symbol: symbolUpper },
    update: {
      market_price: data.market_price,
      market_ytm: data.market_ytm ?? null,
      face_value: data.face_value,
      coupon_rate: data.coupon_rate ?? null,
      coupon_freq: data.coupon_freq ?? null,
      maturity_date: data.maturity_date ? new Date(data.maturity_date) : null,
      asset_class: data.asset_class,
      currency: data.currency,
      name: data.name ?? null
    },
    create: {
      symbol: symbolUpper,
      market_price: data.market_price,
      market_ytm: data.market_ytm ?? null,
      face_value: data.face_value ?? 100,
      coupon_rate: data.coupon_rate ?? null,
      coupon_freq: data.coupon_freq ?? null,
      maturity_date: data.maturity_date ? new Date(data.maturity_date) : null,
      asset_class: data.asset_class ?? "bond",
      currency: data.currency ?? "NGN",
      name: data.name ?? null
    }
  });
  revalidatePath('/products');
  return result;
}

export async function createSecurityTransaction(data: {
  product_id: string;
  direction: "BUY" | "SELL";
  symbol: string;
  units: number;
  price: number;
  ytm?: number;
  value_date: string;
  currency?: string;
}) {
  const result = await prisma.securityTransaction.create({
    data: {
      product_id: data.product_id,
      direction: data.direction,
      symbol: data.symbol,
      units: data.units,
      price: data.price,
      ytm: data.ytm ?? null,
      value_date: new Date(data.value_date),
      currency: data.currency ?? "USD",
    }
  });
  revalidatePath('/products');
  return result;
}

export async function deleteSecurityTransaction(id: string) {
  const result = await prisma.securityTransaction.deleteMany({
    where: { id }
  });
  revalidatePath('/products');
  return result;
}
