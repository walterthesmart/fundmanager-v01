import { PrismaClient } from '@prisma/client';
import { calculateCleanPrice, calculateAccruedInterest, calculateTotalConsideration, calculateTBillPrice, calculateTBillConsideration, isZeroCoupon, calculateDirtyPriceFromYTM } from './src/lib/bond-math';

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

  const sortedSecTx = [...product.security_transactions].sort((a, b) => 
     new Date(a.value_date).getTime() - new Date(b.value_date).getTime()
  );

  // ---------- PAGE.TSX LOGIC ----------
  let pageBondValue = 0;
  const pageLots = new Map<string, {units: number, cost: number}[]>();

  sortedSecTx.forEach(tx => {
    const sym = tx.symbol;
    if (!sym) return;
    
    if (!pageLots.has(sym)) pageLots.set(sym, []);
    const symLots = pageLots.get(sym)!;

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

  pageLots.forEach((symLots, sym) => {
     const instrument = instruments.find(i => i.symbol === sym);
     const isMatured = instrument?.maturity_date && new Date(instrument.maturity_date) < new Date();
     
     if (!isMatured) {
        let marketPrice = instrument?.market_price ?? 100;
        let accruedCoupon = 0;
        
        if (instrument?.market_ytm != null && instrument.maturity_date) {
           const isTBill = instrument.coupon_rate === 0 || instrument.coupon_rate == null;
           const maturityDate = new Date(instrument.maturity_date);
           
           if (isTBill) {
              marketPrice = calculateTBillPrice(instrument.market_ytm, new Date(), maturityDate);
           } else {
              marketPrice = calculateCleanPrice(
                instrument.market_ytm,
                instrument.coupon_rate!,
                new Date(),
                maturityDate,
                instrument.coupon_freq || 2,
                instrument.face_value || 100
              );
              accruedCoupon = calculateAccruedInterest(
                instrument.coupon_rate!,
                new Date(),
                maturityDate,
                instrument.coupon_freq || 2,
                instrument.face_value || 100
              );
           }
        }
        
        symLots.forEach(lot => {
           const faceValueMultiplier = instrument?.face_value || 100;
           if (instrument?.coupon_rate === 0 || instrument?.coupon_rate == null) {
              const val = calculateTBillConsideration(marketPrice, lot.units * faceValueMultiplier);
              pageBondValue += val;
           } else {
              const val = calculateTotalConsideration(marketPrice + accruedCoupon, lot.units, faceValueMultiplier);
              pageBondValue += val;
           }
        });
     }
  });


  // ---------- MODAL LOGIC ----------
  interface Lot {
    units: number;
    faceValue: number;
    cost: number;
    dirtyPrice: number;
    valueDate: Date;
  }
  const modalHoldings = new Map<string, { displayKey: string; lots: Lot[]; realizedGain: number; realizedCoupons: number }>();

  sortedSecTx.forEach(tx => {
    const rawSymbol = tx.symbol || "Unknown";
    const key = rawSymbol.trim().toUpperCase();
    
    const current = modalHoldings.get(key) || { displayKey: rawSymbol, lots: [], realizedGain: 0, realizedCoupons: 0 };
    const instrument = instruments.find(i => i.symbol.toUpperCase() === key);
    
    let accruedAtPurchase = 0;
    let dirtyPrice = Number(tx.price);
    const faceValue = instrument?.face_value || 100;
    
    if (instrument && instrument.coupon_rate && instrument.maturity_date) {
      accruedAtPurchase = calculateAccruedInterest(
        faceValue,
        instrument.coupon_rate,
        new Date(instrument.maturity_date),
        instrument.coupon_freq || 2,
        new Date(tx.value_date)
      );
      dirtyPrice += accruedAtPurchase;
    }
    
    const trancheFaceValue = Number(tx.units) * 100;
    const trancheUnits = trancheFaceValue / 100; 
    const trancheCost = calculateTotalConsideration(dirtyPrice, trancheUnits, faceValue);
    
    if (tx.direction === "BUY") {
      let remainingFaceToBuy = trancheFaceValue;
      
      while (remainingFaceToBuy > 0.01 && current.lots.length > 0 && current.lots[0].faceValue < -0.01) {
         const lot = current.lots[0];
         const shortFace = Math.abs(lot.faceValue);
         
         if (shortFace <= remainingFaceToBuy + 0.01) {
            const costOfCover = (trancheCost / trancheFaceValue) * shortFace;
            current.realizedGain += (lot.cost - costOfCover);
            
            remainingFaceToBuy -= shortFace;
            current.lots.shift();
         } else {
            const fractionCovered = remainingFaceToBuy / shortFace;
            const proceedsOfCovered = lot.cost * fractionCovered;
            const costOfCover = (trancheCost / trancheFaceValue) * remainingFaceToBuy;
            
            current.realizedGain += (proceedsOfCovered - costOfCover);
            
            lot.faceValue += remainingFaceToBuy;
            lot.units += remainingFaceToBuy / 100;
            lot.cost -= proceedsOfCovered;
            remainingFaceToBuy = 0;
         }
      }
      
      if (remainingFaceToBuy > 0.01) {
         current.lots.push({
           units: remainingFaceToBuy / 100,
           faceValue: remainingFaceToBuy,
           cost: (trancheCost / trancheFaceValue) * remainingFaceToBuy,
           dirtyPrice,
           valueDate: new Date(tx.value_date)
         });
      }
    } else if (tx.direction === "SELL") {
      let remainingFaceToSell = trancheFaceValue;
      
      while (remainingFaceToSell > 0.01 && current.lots.length > 0 && current.lots[0].faceValue > 0.01) {
        const lot = current.lots[0];
        
        if (lot.faceValue <= remainingFaceToSell + 0.01) { 
           const soldFace = lot.faceValue;
           const soldUnits = lot.units;
           const costOfSold = lot.cost;
           
           const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
           current.realizedGain += (saleProceeds - costOfSold);
           
           remainingFaceToSell -= soldFace;
           current.lots.shift(); 
        } else { 
           const fractionSold = remainingFaceToSell / lot.faceValue;
           const costOfSold = lot.cost * fractionSold;
           const soldUnits = remainingFaceToSell / 100; 
           
           const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
           current.realizedGain += (saleProceeds - costOfSold);
           
           lot.faceValue -= remainingFaceToSell;
           lot.units -= soldUnits;
           lot.cost -= costOfSold;
           remainingFaceToSell = 0;
        }
      }
      
      if (remainingFaceToSell > 0.01) {
         const soldUnits = remainingFaceToSell / 100;
         const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
         current.lots.push({
           units: -soldUnits,
           faceValue: -remainingFaceToSell,
           cost: saleProceeds, 
           dirtyPrice,
           valueDate: new Date(tx.value_date)
         });
      }
    }
    
    modalHoldings.set(key, current);
  });
  
  let modalMarketValue = 0;

  modalHoldings.forEach(data => {
    let openUnits = 0;
    
    const instrument = instruments.find(i => i.symbol.toUpperCase() === data.displayKey.toUpperCase());
    const hasDetails = instrument && instrument.maturity_date;
    
    data.lots.forEach(lot => {
       openUnits += lot.faceValue; 
    });
    
    let marketPrice = instrument?.market_price ?? 100;
    let marketValue = (openUnits * marketPrice) / 100;
    let accruedCoupon = 0;
    
    const isClosed = Math.abs(openUnits) < 0.01;
    let isMatured = false;
    
    if (hasDetails) {
      const isTBill = isZeroCoupon(instrument!.coupon_rate);
      const maturityDate = new Date(instrument!.maturity_date!);
      if (maturityDate < new Date()) {
          isMatured = true;
      }
      
      if (!isClosed && !isMatured) { 
          if (isTBill) {
            if (instrument!.market_ytm != null) {
              marketPrice = calculateTBillPrice(Number(instrument!.market_ytm), new Date(), maturityDate);
            }
            marketValue = calculateTBillConsideration(marketPrice, openUnits);
          } else {
            if (instrument!.market_ytm != null) {
              marketPrice = calculateCleanPrice(
                Number(instrument!.market_ytm),
                Number(instrument!.coupon_rate!),
                new Date(),
                maturityDate,
                instrument!.coupon_freq || 2,
                instrument!.face_value || 100
              );
              console.log(ARGS: ytm=, rate=, mat=, freq=, face=); const dirtyPrice = calculateDirtyPriceFromYTM(
                Number(instrument!.market_ytm),
                Number(instrument!.coupon_rate!),
                new Date(),
                maturityDate,
                instrument!.coupon_freq || 2,
                instrument!.face_value || 100
              );
              marketValue = calculateTotalConsideration(dirtyPrice, openUnits / 100, instrument!.face_value || 100);
            } else {
              accruedCoupon = calculateAccruedInterest(
                Number(instrument!.coupon_rate!),
                new Date(),
                maturityDate,
                instrument!.coupon_freq || 2,
                instrument!.face_value || 100
              );
              marketValue = calculateTotalConsideration(marketPrice + accruedCoupon, openUnits / 100, instrument!.face_value || 100);
            }
          }
      }
    }
    
    if (!isClosed && !isMatured) {
        modalMarketValue += marketValue;
        if (Math.abs(marketValue) > 1) {
           console.log(`MODAL EVALUATED: ${data.displayKey} = ${marketValue}`);
        }
    }
  });

  console.log(`\nPage Bond Value: ${pageBondValue}`);
  console.log(`Modal Market Value: ${modalMarketValue}`);
  console.log(`Difference: ${pageBondValue - modalMarketValue}`);
}

run().catch(console.error);
