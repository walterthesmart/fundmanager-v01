'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
import { calculateCleanPrice } from "../src/lib/bond-math"

export async function applyPricesAction(
  updates: { id: string; price: number; mode: "manual" | "automated"; source: string | null; cash_balance?: number }[],
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
        ...(update.cash_balance !== undefined ? { cash_balance: update.cash_balance } : {})
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
        ticker = ticker.split('-')[1] || ticker; // e.g. SGF-IAU -> IAU
      }
      
      const quote = (await yahooFinance.quote(ticker)) as any;
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

export interface LiveQuoteInfo {
  price: number;
  change: number;
  changePercent: number;
  name: string;
}

export async function fetchLiveQuotes(symbols: string[]): Promise<Record<string, LiveQuoteInfo>> {
  const quotes: Record<string, LiveQuoteInfo> = {};
  const validSymbols = symbols.filter(sym => sym && sym.trim() !== '' && sym !== 'Cash' && sym !== 'GEF Cash');
  
  if (validSymbols.length === 0) return quotes;

  await Promise.all(
    validSymbols.map(async (sym) => {
      try {
        const quote = (await yahooFinance.quote(sym)) as any;
        if (quote && quote.regularMarketPrice) {
          const companyName = quote.shortName || quote.longName || sym;
          quotes[sym] = {
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange ?? 0,
            changePercent: quote.regularMarketChangePercent ?? 0,
            name: companyName
          };
          // Also persist the instrument name in DB
          if (companyName && companyName !== sym) {
            try {
              await prisma.instrument.updateMany({
                where: { symbol: sym },
                data: { name: companyName }
              });
            } catch {}
          }
        }
      } catch (err) {
        console.error(`Failed to fetch quote for ${sym}:`, err);
      }
    })
  );
  return quotes;
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
    } as any,
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
    } as any
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

export async function updateMarketPricesFromSheet() {
  const SHEET_XLSX_URL = "https://docs.google.com/spreadsheets/d/11Mjg2bUjhoGF1phHxm7LESDPRABPfLq88o1vL4N4fYI/export?format=xlsx";

  const SYMBOL_MAPPING: Record<string, string> = {
    "REPUBLIC OF ANGOLA OCT 2035": "ANGOL 9.875 10/15/35",
    "SEPLAT ENERGY MAR 2030": "SEPLAT 9.125 03/21/30",
  };

  function parseTbillDate(dbSymbol: string): number | null {
    const str = dbSymbol.replace(/NIGTB\s*/i, '').trim();
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]!);
      const monthStr = parts[1]!;
      const year = parseInt(parts[2]!);
      let month = parseInt(monthStr);
      if (isNaN(month)) {
        const m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(monthStr.toUpperCase());
        if (m !== -1) month = m + 1;
      }
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(Date.UTC(year, month - 1, day)).getTime();
      }
    }
    return null;
  }
  
  function getSheetSymbolDate(rawSymbol: any): number | null {
    if (typeof rawSymbol === 'number') {
      return new Date((rawSymbol - 25569) * 86400 * 1000).getTime();
    }
    if (typeof rawSymbol === 'string') {
      const trimmed = rawSymbol.trim();
      if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          return new Date(Date.UTC(parseInt(parts[2]!), parseInt(parts[1]!) - 1, parseInt(parts[0]!))).getTime();
        }
      }
      const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
      if (match) {
        const [, day, monthStr, year] = match;
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const m = months.findIndex(m => monthStr!.toUpperCase().startsWith(m));
        if (m !== -1) {
          return new Date(Date.UTC(parseInt(year!), m, parseInt(day!))).getTime();
        }
      }
    }
    return null;
  }

  try {
    const { read, utils } = await import('xlsx');
    
    const response = await fetch(SHEET_XLSX_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = read(arrayBuffer);
    
    let updatedCount = 0;

    // Process FBNUK (Flat table)
    if (workbook.SheetNames.includes("FBNUK")) {
      const records = utils.sheet_to_json<any>(workbook.Sheets["FBNUK"]!);
      for (const row of records) {
        const sheetSymbol = row["Symbol"];
        if (!sheetSymbol) continue;

        const bidPxStr = row["Bid Px"];
        const bidYieldStr = row["Bid Yield"] || row["Bid %"]; 

        let bidPx = typeof bidPxStr === 'number' ? bidPxStr : parseFloat(bidPxStr);
        const bidYield = typeof bidYieldStr === 'number' ? bidYieldStr : parseFloat(bidYieldStr);

        if (isNaN(bidPx) && isNaN(bidYield)) continue;

        const dbSymbol = SYMBOL_MAPPING[sheetSymbol] || sheetSymbol;
        const instrument = await prisma.instrument.findFirst({ where: { symbol: dbSymbol } });
        if (instrument) {
          if (isNaN(bidPx) && !isNaN(bidYield) && instrument.symbol.toUpperCase().includes('FGN')) {
            if (instrument.coupon_rate && instrument.maturity_date) {
              const cleanPrice = calculateCleanPrice(
                bidYield,
                instrument.coupon_rate,
                new Date(),
                instrument.maturity_date,
                instrument.coupon_freq || 2,
                instrument.face_value || 100
              );
              if (!isNaN(cleanPrice) && cleanPrice > 0) {
                bidPx = cleanPrice;
              }
            }
          }

          const updateData: any = {};
          if (!isNaN(bidPx)) updateData.market_price = bidPx;
          if (!isNaN(bidYield)) updateData.market_ytm = bidYield;

          if (Object.keys(updateData).length > 0) {
            await prisma.instrument.update({
              where: { id: instrument.id },
              data: updateData,
            });
            updatedCount++;
          }
        }
      }
    }

    // Process Pivoted tables (Bloomberg first, then TBills Runs so TBills takes precedence)
    const pivotedSheets = ["Bloomberg", "TBills Runs"];
    
    for (const sheetName of pivotedSheets) {
      if (workbook.SheetNames.includes(sheetName)) {
        const data = utils.sheet_to_json<any[]>(workbook.Sheets[sheetName]!, { header: 1 });
        if (data.length >= 5) {
          const symbolsRow = data[3]!;
          const latestDataRow = data[data.length - 1]!;
          
          const allInstruments = await prisma.instrument.findMany();

          for (let col = 0; col < symbolsRow.length; col++) {
            const rawSymbol = symbolsRow[col];
            if (!rawSymbol || rawSymbol === 'FX') continue;
            
            let ytmVal = latestDataRow[col];
            if (ytmVal === '#N/A N/A' || ytmVal === undefined || ytmVal === null) continue;
            
            const ytmNum = typeof ytmVal === 'number' ? ytmVal : parseFloat(ytmVal);
            if (isNaN(ytmNum)) continue;
            
            let matchedInstruments: any[] = [];
            const sheetDate = getSheetSymbolDate(rawSymbol);

            if (sheetDate !== null) {
              // Match T-Bill by parsed date
              matchedInstruments = allInstruments.filter(i => 
                i.symbol.toUpperCase().startsWith('NIGTB') && parseTbillDate(i.symbol) === sheetDate
              );
            } else if (typeof rawSymbol === 'string' && (rawSymbol.includes('-') || rawSymbol.includes('NIGB'))) {
              // Match Bond by year
              const match = rawSymbol.match(/(20\d{2})/);
              if (match && sheetName !== "TBills Runs") {
                const year = match[1];
                matchedInstruments = allInstruments.filter(i => 
                  i.symbol.toUpperCase() === `FGN ${year} BOND`
                );
              }
            }

            for (const matchedInstrument of matchedInstruments) {
              // For FGN Bonds (not T-Bills), we also want to calculate and update market_price
              const isFGN = matchedInstrument.symbol.toUpperCase().includes('FGN');
              let marketPrice = undefined;
              
              if (isFGN && matchedInstrument.coupon_rate && matchedInstrument.maturity_date) {
                const cleanPrice = calculateCleanPrice(
                  ytmNum,
                  matchedInstrument.coupon_rate,
                  new Date(),
                  matchedInstrument.maturity_date,
                  matchedInstrument.coupon_freq || 2,
                  matchedInstrument.face_value || 100
                );
                if (!isNaN(cleanPrice) && cleanPrice > 0) {
                  marketPrice = cleanPrice;
                }
              }
              
              await prisma.instrument.update({
                where: { id: matchedInstrument.id },
                data: { 
                  market_ytm: ytmNum,
                  ...(marketPrice !== undefined ? { market_price: marketPrice } : {}) 
                },
              });
              updatedCount++;
            }
          }
        }
      }
    }

    revalidatePath('/products');
    return { success: true, updatedCount };
  } catch (err: any) {
    console.error("Error updating prices from sheet:", err);
    return { success: false, error: err.message };
  }
}

export async function importEquityTransactions(productId: string, txs: any[]) {
  try {
    let imported = 0;
    for (const tx of txs) {
      if (tx.type === 'TXIN' || tx.type === 'TXOUT') {
        const amount = (tx.shares * tx.price) + (tx.fees || 0);
        await prisma.cashTransaction.create({
          data: {
            product_id: productId,
            direction: tx.type === 'TXIN' ? 'inflow' : 'outflow',
            amount: amount,
            value_date: new Date(tx.date),
            source_name: "Equity Import",
            reference: `import-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          }
        });
        imported++;
      } else {
        await prisma.securityTransaction.create({
          data: {
            product_id: productId,
            direction: tx.type, // 'BUY', 'SELL', 'DIVIDEND', etc.
            symbol: tx.symbol,
            units: tx.shares,
            price: tx.price,
            value_date: new Date(tx.date),
          }
        });
        imported++;
      }
    }
    revalidatePath('/products');
    return { success: true, imported };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function clearEquityTransactions(productId: string) {
  try {
    const deletedSec = await prisma.securityTransaction.deleteMany({
      where: { product_id: productId }
    });
    
    const deletedCash = await prisma.cashTransaction.deleteMany({
      where: { product_id: productId }
    });

    revalidatePath('/products');
    return { 
      success: true, 
      cleared: deletedSec.count + deletedCash.count 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchHistoricalQuotes(symbol: string, period1: string, period2?: string): Promise<any[]> {
  try {
    const data = await yahooFinance.historical(symbol, {
      period1,
      period2: period2 || new Date().toISOString().split('T')[0],
      interval: '1d'
    });
    return data;
  } catch (error) {
    console.error(`Failed to fetch historical quotes for ${symbol}:`, error);
    return [];
  }
}

export async function snapshotProductNAV(productId: string, currentNav: number) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to beginning of the day

    // Check if we already have a snapshot for today
    const existing = await prisma.priceHistory.findFirst({
      where: {
        product_id: productId,
        occurred_at: {
          gte: today,
        },
      }
    });

    if (existing) {
      // Update existing snapshot for today
      await prisma.priceHistory.update({
        where: { id: existing.id },
        data: { new_price: currentNav, occurred_at: new Date() }
      });
    } else {
      // Get the last known price to set as old_price
      const lastHistory = await prisma.priceHistory.findFirst({
        where: { product_id: productId },
        orderBy: { occurred_at: 'desc' }
      });
      const old_price = lastHistory ? lastHistory.new_price : currentNav;

      await prisma.priceHistory.create({
        data: {
          product_id: productId,
          old_price: old_price,
          new_price: currentNav,
          occurred_at: new Date()
        }
      });
    }

    revalidatePath('/products');
    return { success: true };
  } catch (error: any) {
    console.error("Failed to snapshot NAV:", error);
    return { success: false, error: error.message };
  }
}
