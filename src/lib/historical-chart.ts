import { calculateTotalConsideration, calculateCouponsReceived, isZeroCoupon } from './bond-math';

export function generateHistoricalAUM(
  cashTxns: any[],
  secTxns: any[],
  instruments: any[],
  baseCash: number = 0
): { date: string; nav: number }[] {
  // We collect all unique dates from transactions to form the timeline
  const events: { date: Date; type: "CASH" | "SECURITY"; tx: any }[] = [];

  cashTxns.forEach(tx => {
    events.push({ date: new Date(tx.value_date), type: "CASH", tx });
  });

  secTxns.forEach(tx => {
    events.push({ date: new Date(tx.value_date), type: "SECURITY", tx });
  });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (events.length === 0) return [];

  const chartData: { date: string; nav: number }[] = [];
  let netContributions = 0;
  
  // We keep a running ledger of active lots to correctly accrue coupons and track book value dynamically
  const activeLots = new Map<string, any[]>();
  let totalRealizedGain = 0;
  
  // Date formatting cache
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  events.forEach((event, index) => {
    if (event.type === "CASH") {
      netContributions += (event.tx.direction === "inflow" ? Number(event.tx.amount) : -Number(event.tx.amount));
    } else {
      // Security Transaction
      const tx = event.tx;
      const rawSymbol = tx.symbol || "Unknown";
      const key = rawSymbol.trim().toUpperCase();
      
      const lots = activeLots.get(key) || [];
      const instrument = instruments.find(i => i.symbol.toUpperCase() === key);
      const faceValue = instrument?.face_value || 100;
      
      // We don't accrue interest into dirtyPrice for historical tracking if we just want clean book value,
      // but to be mathematically consistent with the main engine, we should.
      // Wait, if we use the exact same FIFO logic, we can track exact realized gain!
      
      let dirtyPrice = Number(tx.price);
      // NOTE: We don't need exact Accrued at Purchase here for the historical chart if we just track proceeds vs cost.
      // But let's keep it simple: Total Cost = tx.units * tx.price ? No, calculateTotalConsideration.
      const trancheFaceValue = Number(tx.units) * 100;
      const trancheUnits = trancheFaceValue / 100;
      const trancheCost = calculateTotalConsideration(dirtyPrice, trancheUnits, faceValue);
      
      if (tx.direction === "BUY") {
        let remainingFaceToBuy = trancheFaceValue;
        
        while (remainingFaceToBuy > 0.01 && lots.length > 0 && lots[0].faceValue < -0.01) {
           const lot = lots[0];
           const shortFace = Math.abs(lot.faceValue);
           
           if (shortFace <= remainingFaceToBuy + 0.01) {
              const costOfCover = (trancheCost / trancheFaceValue) * shortFace;
              totalRealizedGain += (lot.cost - costOfCover);
              remainingFaceToBuy -= shortFace;
              lots.shift();
           } else {
              const fractionCovered = remainingFaceToBuy / shortFace;
              const proceedsOfCovered = lot.cost * fractionCovered;
              const costOfCover = (trancheCost / trancheFaceValue) * remainingFaceToBuy;
              totalRealizedGain += (proceedsOfCovered - costOfCover);
              lot.faceValue += remainingFaceToBuy;
              lot.cost -= proceedsOfCovered;
              remainingFaceToBuy = 0;
           }
        }
        
        if (remainingFaceToBuy > 0.01) {
           lots.push({
             faceValue: remainingFaceToBuy,
             cost: (trancheCost / trancheFaceValue) * remainingFaceToBuy,
             valueDate: new Date(tx.value_date)
           });
        }
      } else if (tx.direction === "SELL") {
        let remainingFaceToSell = trancheFaceValue;
        
        while (remainingFaceToSell > 0.01 && lots.length > 0 && lots[0].faceValue > 0.01) {
           const lot = lots[0];
           if (lot.faceValue <= remainingFaceToSell + 0.01) {
              const saleProceeds = calculateTotalConsideration(dirtyPrice, lot.faceValue / 100, faceValue);
              totalRealizedGain += (saleProceeds - lot.cost);
              remainingFaceToSell -= lot.faceValue;
              lots.shift();
           } else {
              const fractionSold = remainingFaceToSell / lot.faceValue;
              const costOfSold = lot.cost * fractionSold;
              const saleProceeds = calculateTotalConsideration(dirtyPrice, remainingFaceToSell / 100, faceValue);
              totalRealizedGain += (saleProceeds - costOfSold);
              lot.faceValue -= remainingFaceToSell;
              lot.cost -= costOfSold;
              remainingFaceToSell = 0;
           }
        }
        
        if (remainingFaceToSell > 0.01) {
           const saleProceeds = calculateTotalConsideration(dirtyPrice, remainingFaceToSell / 100, faceValue);
           lots.push({
             faceValue: -remainingFaceToSell,
             cost: saleProceeds,
             valueDate: new Date(tx.value_date)
           });
        }
      }
      activeLots.set(key, lots);
    }
    
    // Now, calculate the Total AUM on this date!
    // Total AUM = Net Contributions + Total Realized Gain + Active Book Value + Active Coupons Received
    // Actually, it's easier: Cash Balance + Active Book Value + Accrued Coupons
    
    // Let's just track Book AUM (Amortized Cost AUM)
    let totalBookValue = 0;
    let totalCouponsReceived = 0;
    
    activeLots.forEach((lots, key) => {
       const instrument = instruments.find(i => i.symbol.toUpperCase() === key);
       // Exclude bonds that have matured prior to or on the event date
       const isMatured = instrument?.maturity_date && new Date(instrument.maturity_date) <= event.date;
       
       if (!isMatured) {
           lots.forEach(lot => {
              totalBookValue += lot.cost;
              if (instrument && instrument.maturity_date && !isZeroCoupon(instrument.coupon_rate) && lot.faceValue > 0) {
                  totalCouponsReceived += calculateCouponsReceived(
                     lot.faceValue,
                     instrument.coupon_rate,
                     new Date(instrument.maturity_date),
                     instrument.coupon_freq || 2,
                     lot.valueDate,
                     event.date
                  );
              }
           });
       }
    });
    
    const nav = baseCash + netContributions + totalRealizedGain + totalCouponsReceived + totalBookValue;
    
    // Only push if it's the last event of the day to avoid duplicates
    const nextEvent = events[index + 1];
    if (!nextEvent || nextEvent.date.getTime() !== event.date.getTime()) {
      chartData.push({
        date: formatDate(event.date),
        nav
      });
    }
  });
  
  return chartData;
}
