import { PrismaClient } from '@prisma/client';
import { calculateCleanPrice, calculateAccruedInterest, calculateTotalConsideration, calculateTBillPrice, calculateTBillConsideration } from './src/lib/bond-math';

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany({
    where: { ticker: { contains: "GIF" } },
    include: {
      cash_transactions: true,
      security_transactions: true,
    }
  });

  const product = products[0];
  const allSymbols = [...new Set(product.security_transactions.map(t => t.symbol).filter(Boolean) as string[])];
  const instruments = await prisma.instrument.findMany({
    where: { symbol: { in: allSymbols } },
    select: { symbol: true, updated_at: true, maturity_date: true, market_price: true, market_ytm: true, face_value: true, coupon_rate: true, coupon_freq: true }
  });

  let bondValue = 0;
  const lots = new Map<string, {units: number, cost: number}[]>();
  const currentSymbols = new Set<string>();

  const sortedSecTx = [...product.security_transactions].sort((a, b) => 
     new Date(a.value_date).getTime() - new Date(b.value_date).getTime()
  );

  sortedSecTx.forEach(tx => {
    const sym = tx.symbol;
    if (!sym) return;
    currentSymbols.add(sym);
    
    if (!lots.has(sym)) lots.set(sym, []);
    const symLots = lots.get(sym)!;

    if (tx.direction === "BUY") {
       const units = Number(tx.units);
       const price = Number(tx.price);
       symLots.push({ units, cost: units * price });
    } else {
       let remainingToSell = Number(tx.units);
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
       if (remainingToSell > 0.01) {
          symLots.push({ units: -remainingToSell, cost: -remainingToSell * Number(tx.price) });
       }
    }
  });
  
  let oldBondValue = 0;

  lots.forEach((symLots, sym) => {
     const instrument = instruments.find(i => i.symbol === sym);
     const isMatured = instrument?.maturity_date && new Date(instrument.maturity_date) < new Date();
     
     if (!isMatured) {
        // old way
        symLots.forEach(lot => {
           console.log(`OLD BOND ${sym}: units=${lot.units}, cost=${lot.cost}`);
           oldBondValue += lot.cost;
        });
     }
  });

  console.log(`Old Bond Value: ${oldBondValue}`);
}

run().catch(console.error);
