import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProductsClient } from "./products-client"

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  
  const products = await prisma.product.findMany({
    include: {
      cash_transactions: true,
      security_transactions: true,
    },
    orderBy: [
      { asset_class: 'asc' },
      { name: 'asc' }
    ]
  })

  const allSymbols = [...new Set(products.flatMap(p => p.security_transactions.map(t => t.symbol).filter(Boolean) as string[]))];
  const instruments = await prisma.instrument.findMany({
    where: { symbol: { in: allSymbols } },
    select: { symbol: true, updated_at: true, maturity_date: true }
  });
  const instrumentMap = new Map(instruments.map(i => [i.symbol, i.updated_at]));

  const productsWithAum = products.map(product => {
    let cash = 0;
    product.cash_transactions.forEach(tx => {
      if (tx.direction === "inflow") cash += tx.amount;
      else if (tx.direction === "outflow") cash -= tx.amount;
    });
    
    let bondValue = 0;
    const currentSymbols = new Set<string>();
    const lots = new Map<string, {units: number, cost: number}[]>();
    
    // Sort chronologically for FIFO
    const sortedTxs = [...product.security_transactions].sort((a,b) => a.value_date.getTime() - b.value_date.getTime());
    
    sortedTxs.forEach(tx => {
      const sym = tx.symbol || "Unknown";
      if (tx.symbol) currentSymbols.add(tx.symbol);
      
      if (!lots.has(sym)) lots.set(sym, []);
      const symLots = lots.get(sym)!;
      
      if (tx.direction === "BUY") {
         let remainingToBuy = Number(tx.units);
         // Offset short lots first
         while (remainingToBuy > 0.01 && symLots.length > 0 && symLots[0].units < -0.01) {
            if (Math.abs(symLots[0].units) <= remainingToBuy + 0.01) {
               remainingToBuy -= Math.abs(symLots[0].units);
               symLots.shift();
            } else {
               const fractionCovered = remainingToBuy / Math.abs(symLots[0].units);
               symLots[0].cost -= symLots[0].cost * fractionCovered;
               symLots[0].units += remainingToBuy;
               remainingToBuy = 0;
            }
         }
         if (remainingToBuy > 0.01) {
            symLots.push({ units: remainingToBuy, cost: remainingToBuy * Number(tx.price) });
         }
      } else if (tx.direction === "SELL") {
         let remainingToSell = Number(tx.units);
         // Offset long lots first
         while (remainingToSell > 0.01 && symLots.length > 0 && symLots[0].units > 0.01) {
            if (symLots[0].units <= remainingToSell + 0.01) {
               remainingToSell -= symLots[0].units;
               symLots.shift();
            } else {
               const fractionSold = remainingToSell / symLots[0].units;
               symLots[0].cost -= symLots[0].cost * fractionSold;
               symLots[0].units -= remainingToSell;
               remainingToSell = 0;
            }
         }
         // Push short lots if any remaining
         if (remainingToSell > 0.01) {
            symLots.push({ units: -remainingToSell, cost: -remainingToSell * Number(tx.price) });
         }
      }
    });
    
    let oldestYtmUpdate: Date | null = null;
    currentSymbols.forEach(symbol => {
      const updatedAt = instrumentMap.get(symbol);
      if (updatedAt) {
        if (!oldestYtmUpdate || updatedAt < oldestYtmUpdate) oldestYtmUpdate = updatedAt;
      }
    });
    
    lots.forEach((symLots, sym) => {
       const instrument = instruments.find(i => i.symbol === sym);
       const isMatured = instrument?.maturity_date && new Date(instrument.maturity_date) < new Date();
       if (!isMatured) {
          symLots.forEach(lot => {
             bondValue += lot.cost;
          });
       }
    });

    const aum = bondValue + ((product as any).cash_balance || 0);
    const { cash_transactions, security_transactions, ...rest } = product;
    
    // For GUI, we can default aum to 0 if no transactions exist, 
    // but let's just expose it on the object
    return { ...rest, aum: aum > 0 ? aum : (product.price || 0), oldestYtmUpdate };
  });

  return <ProductsClient initialProducts={productsWithAum} userId={session?.user?.id} />
}
