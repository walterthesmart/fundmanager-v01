import { PrismaClient } from '@prisma/client';
import { calculateCouponsReceived, isZeroCoupon } from './src/lib/bond-math';

const prisma = new PrismaClient();

async function run() {
  const instruments = await prisma.instrument.findMany();
  const txns = await prisma.securityTransaction.findMany({
    orderBy: { value_date: 'asc' }
  });
  
  const results: Record<string, any> = {};
  
  txns.forEach((tx: any) => {
     const symbol = tx.symbol?.trim().toUpperCase();
     if (!symbol) return;
     
     if (!results[symbol]) {
        results[symbol] = { lots: [], realizedGain: 0, realizedCoupons: 0, closed: false, couponBreakdown: [] };
     }
     
     const current = results[symbol];
     const instrument = instruments.find(i => i.symbol.toUpperCase() === symbol);
     
     const trancheFaceValue = Number(tx.units) * 100;
     
     if (tx.direction === "BUY") {
        current.lots.push({
           faceValue: trancheFaceValue,
           valueDate: new Date(tx.value_date)
        });
     } else if (tx.direction === "SELL") {
        let remainingFaceToSell = trancheFaceValue;
        
        while (remainingFaceToSell > 0.01 && current.lots.length > 0) {
           const lot = current.lots[0];
           
           if (lot.faceValue <= remainingFaceToSell + 0.01) {
              const soldFace = lot.faceValue;
              
              if (instrument && instrument.coupon_rate && instrument.maturity_date && !isZeroCoupon(instrument.coupon_rate)) {
                 const coupons = calculateCouponsReceived(
                    soldFace,
                    instrument.coupon_rate,
                    new Date(instrument.maturity_date),
                    instrument.coupon_freq || 2,
                    lot.valueDate,
                    new Date(tx.value_date)
                 );
                 current.realizedCoupons += coupons;
                 current.couponBreakdown.push(`Sold lot of ${symbol} (${soldFace}), bought on ${lot.valueDate.toISOString().split('T')[0]}, sold on ${tx.value_date.toISOString().split('T')[0]}. Coupons: ${coupons}`);
              }
              
              remainingFaceToSell -= soldFace;
              current.lots.shift();
           } else {
              if (instrument && instrument.coupon_rate && instrument.maturity_date && !isZeroCoupon(instrument.coupon_rate)) {
                 const coupons = calculateCouponsReceived(
                    remainingFaceToSell,
                    instrument.coupon_rate,
                    new Date(instrument.maturity_date),
                    instrument.coupon_freq || 2,
                    lot.valueDate,
                    new Date(tx.value_date)
                 );
                 current.realizedCoupons += coupons;
                 current.couponBreakdown.push(`Sold partial lot of ${symbol} (${remainingFaceToSell}), bought on ${lot.valueDate.toISOString().split('T')[0]}, sold on ${tx.value_date.toISOString().split('T')[0]}. Coupons: ${coupons}`);
              }
              
              lot.faceValue -= remainingFaceToSell;
              remainingFaceToSell = 0;
           }
        }
     }
  });
  
  console.log("=== FGN 2032 ===");
  const fgn2032 = txns.filter((t: any) => t.symbol.toUpperCase().includes("2032"));
  console.dir(fgn2032, {depth: null});
  
  console.log("\n=== FGN 2032 Instrument Info ===");
  const inst2032 = instruments.find(i => i.symbol.toUpperCase().includes("2032"));
  console.dir(inst2032, {depth: null});
  
  const res2032 = results[Object.keys(results).find(k => k.includes("2032")) || ""];
  console.log("\n=== FGN 2032 Coupon Breakdown ===");
  if (res2032) {
      console.log(res2032.couponBreakdown);
  }
  
  console.log("\n=== ALL CLOSED BONDS WITH REALIZED COUPONS ===");
  for (const [symbol, data] of Object.entries(results)) {
     const isClosed = data.lots.reduce((s: number, l: any) => s + l.faceValue, 0) < 0.01;
     if (isClosed && data.realizedCoupons > 0) {
        console.log(`${symbol}: Realized Coupons = ${data.realizedCoupons}`);
     }
  }
}

run().catch(console.error);
