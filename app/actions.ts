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
