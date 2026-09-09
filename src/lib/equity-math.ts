import { calculateTimeWeightedReturn, calculateMoneyWeightedReturn } from '@railpath/finance-toolkit';

export interface EquityTransaction {
  id?: string;
  date: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'TXIN' | 'TXOUT';
  shares: number;
  price: number;
  fees: number;
  amount: number;
}

export interface PortfolioPosition {
  symbol: string;
  shares: number;
  averagePrice: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  returnAmount: number;
  returnPercentage: number;
  realizedReturn: number;
  assetClass?: string;
}

export const getHistoricalPrice = (livePrices: Record<string, { price: number; historical?: { date: string; close: number }[] }>, symbol: string, targetDateStr: string): number | null => {
  const data = livePrices[symbol]?.historical;
  if (!data || data.length === 0) return null;
  
  const targetTime = new Date(targetDateStr).getTime();
  let closestPrice = data[0]!.close;
  let minDiff = Infinity;
  
  for (const h of data) {
    const hTime = new Date(h.date).getTime();
    const diff = Math.abs(targetTime - hTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestPrice = h.close;
    }
  }
  return closestPrice;
};

export function calculatePositions(
  transactions: EquityTransaction[],
  livePrices: Record<string, { price: number; historical?: { date: string; close: number }[] }>,
  startDateStr?: string | null
): PortfolioPosition[] {
  const positionsMap: Record<string, { shares: number; totalCost: number; realizedReturn: number; assetClass: string }> = {};
  let cashBalance = 0;

  // Sort transactions chronologically
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const targetStartMs = startDateStr ? new Date(startDateStr).getTime() : 0;
  
  const beforeTxs = targetStartMs > 0 ? sortedTxs.filter(tx => new Date(tx.date).getTime() < targetStartMs) : sortedTxs;
  const afterTxs = targetStartMs > 0 ? sortedTxs.filter(tx => new Date(tx.date).getTime() >= targetStartMs) : [];

  const processTx = (tx: EquityTransaction) => {
    const amount = (tx.shares * tx.price) + (tx.fees || 0);
    const sellProceeds = (tx.shares * tx.price) - (tx.fees || 0);

    if (tx.symbol === 'Cash' || tx.symbol === 'GEF Cash') {
      if (tx.type === 'TXIN' || tx.type === 'BUY') {
        cashBalance += tx.shares * tx.price;
      } else if (tx.type === 'TXOUT' || tx.type === 'SELL') {
        cashBalance -= tx.shares * tx.price;
      }
      return;
    }

    if (!positionsMap[tx.symbol]) {
      positionsMap[tx.symbol] = { shares: 0, totalCost: 0, realizedReturn: 0, assetClass: 'Stock' };
    }

    const pos = positionsMap[tx.symbol]!;
    (pos as any).lastTradedPrice = tx.price;
    
    // We assume tx.shares is positive in the dataset for both BUY and SELL.
    const isBuy = tx.type === 'BUY';
    const tradeShares = isBuy ? tx.shares : -tx.shares;
    
    // Determine if we are increasing our position magnitude
    const isIncreasing = (pos.shares >= 0 && tradeShares > 0) || (pos.shares <= 0 && tradeShares < 0);
    
    if (isIncreasing) {
      pos.shares += tradeShares;
      // If long, we add cost. If short, we add the negative proceeds to totalCost.
      pos.totalCost += tradeShares * tx.price; 
    } else {
      // We are reducing the position
      const avgCost = pos.shares !== 0 ? Math.abs(pos.totalCost / pos.shares) : 0;
      
      let realizedGain = 0;
      if (Math.abs(tradeShares) > Math.abs(pos.shares)) {
        // Flipping the position (e.g. from long 100 to short 50)
        const closingShares = Math.abs(pos.shares);
        if (pos.shares > 0) {
           realizedGain = closingShares * (tx.price - avgCost);
        } else {
           realizedGain = closingShares * (avgCost - tx.price);
        }
        
        const flipShares = tradeShares + pos.shares;
        pos.shares = flipShares;
        pos.totalCost = flipShares * tx.price;
      } else {
        // Just reducing the position
        if (pos.shares > 0) {
           realizedGain = Math.abs(tradeShares) * (tx.price - avgCost);
        } else {
           realizedGain = Math.abs(tradeShares) * (avgCost - tx.price);
        }
        
        pos.totalCost += (tradeShares / pos.shares) * pos.totalCost;
        pos.shares += tradeShares;
      }
      
      pos.realizedReturn += realizedGain;
    }
    
    // Cash balance impact is independent of whether we are long or short
    if (tx.type === 'BUY') {
      cashBalance -= amount;
    } else if (tx.type === 'SELL') {
      cashBalance += sellProceeds;
    }
  };

  beforeTxs.forEach(processTx);

  if (targetStartMs > 0 && startDateStr) {
    Object.keys(positionsMap).forEach(symbol => {
      const pos = positionsMap[symbol]!;
      if (Math.abs(pos.shares) > 0.000001) {
        const histPrice = getHistoricalPrice(livePrices, symbol, startDateStr);
        const priceToUse = histPrice !== null ? histPrice : (livePrices[symbol]?.price || 0);
        pos.totalCost = pos.shares * priceToUse;
      } else {
        pos.totalCost = 0;
      }
    });
  }

  afterTxs.forEach(processTx);

  const positions: PortfolioPosition[] = [];

  Object.keys(positionsMap).forEach((symbol) => {
    const pos = positionsMap[symbol]!;
    if (Math.abs(pos.shares) <= 0.000001) return; // Filter out closed positions

    const currentPrice = livePrices[symbol]?.price || (pos as any).lastTradedPrice || 0;
    const averagePrice = pos.shares !== 0 ? Math.abs(pos.totalCost / pos.shares) : 0;
    const currentValue = pos.shares * currentPrice;
    const returnAmount = currentValue - pos.totalCost;
    const returnPercentage = pos.totalCost !== 0 ? (returnAmount / Math.abs(pos.totalCost)) * 100 : 0;

    positions.push({
      symbol,
      shares: pos.shares,
      averagePrice,
      totalCost: pos.totalCost,
      currentPrice,
      currentValue,
      returnAmount,
      returnPercentage,
      realizedReturn: pos.realizedReturn,
      assetClass: pos.assetClass,
    });
  });

  positions.push({
    symbol: 'Cash',
    shares: cashBalance,
    averagePrice: 1,
    totalCost: cashBalance,
    currentPrice: 1,
    currentValue: cashBalance,
    returnAmount: 0,
    returnPercentage: 0,
    realizedReturn: 0,
    assetClass: 'Cash',
  });

  return positions.sort((a, b) => b.currentValue - a.currentValue);
}

export function calculateAdvancedMetrics(
  transactions: EquityTransaction[], 
  livePrices: Record<string, { price: number; historical?: { date: string; close: number }[] }>, 
  finalValue: number,
  startDateStr?: string | null,
  isCashExcluded: boolean = false
) {
  if (transactions.length === 0 || finalValue === 0) {
    return { mwr: 0, twr: 0 };
  }

  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const mwrCashFlows: number[] = [];
  const twrCashFlows: number[] = [];
  const dates: Date[] = [];
  const portfolioValues: number[] = [];
  
  let currentCash = 0;
  const holdings: Record<string, number> = {};

  const getPortfolioValueAtDate = (dateStr: string): number => {
    let val = currentCash;
    for (const [sym, shares] of Object.entries(holdings)) {
      if (shares > 0) {
        const histPrice = getHistoricalPrice(livePrices, sym, dateStr);
        const priceToUse = histPrice !== null ? histPrice : (livePrices[sym]?.price || 0);
        val += shares * priceToUse;
      }
    }
    return val;
  };

  let initialValue = 0;
  const targetStartMs = startDateStr ? new Date(startDateStr).getTime() : 0;
  let hasSetInitialValue = false;

  sortedTxs.forEach((tx) => {
    const amount = (tx.price * tx.shares) + (tx.fees || 0);
    const date = new Date(tx.date);
    const txTime = date.getTime();

    if (targetStartMs > 0 && txTime >= targetStartMs && !hasSetInitialValue) {
      initialValue = getPortfolioValueAtDate(tx.date);
      hasSetInitialValue = true;
    }

    let isExternalCF = false;
    let cfAmount = 0;
    let isDeposit = false;

    if (tx.symbol === 'Cash' || tx.symbol === 'GEF Cash') {
      cfAmount = tx.shares * tx.price;
      if (tx.type === 'TXIN' || tx.type === 'BUY') {
         currentCash += cfAmount;
         isExternalCF = true;
         isDeposit = true;
      } else if (tx.type === 'TXOUT' || tx.type === 'SELL') {
         currentCash -= cfAmount;
         isExternalCF = true;
         isDeposit = false;
      }
    } else {
      if (tx.type === 'TXIN') {
         cfAmount = tx.shares * tx.price;
         if (!isCashExcluded) currentCash += cfAmount;
         isExternalCF = true;
         isDeposit = true;
      } else if (tx.type === 'TXOUT') {
         cfAmount = tx.shares * tx.price;
         if (!isCashExcluded) currentCash -= cfAmount;
         isExternalCF = true;
         isDeposit = false;
      } else if (tx.type === 'BUY') {
         if (!isCashExcluded) currentCash -= amount;
         holdings[tx.symbol] = (holdings[tx.symbol] || 0) + tx.shares;
         
         if (isCashExcluded) {
            isExternalCF = true;
            isDeposit = true;
            cfAmount = amount;
         }
      } else if (tx.type === 'SELL') {
         const sellProceeds = (tx.price * tx.shares) - (tx.fees || 0);
         if (!isCashExcluded) currentCash += sellProceeds;
         holdings[tx.symbol] = (holdings[tx.symbol] || 0) - tx.shares;
         
         if (isCashExcluded) {
            isExternalCF = true;
            isDeposit = false;
            cfAmount = sellProceeds;
         }
      }
    }

    // Only record cash flows if they occur AFTER the start date (in performance mode)
    if (isExternalCF && (targetStartMs === 0 || txTime >= targetStartMs)) {
       if (isDeposit) {
          mwrCashFlows.push(-cfAmount);
          twrCashFlows.push(cfAmount);
       } else {
          mwrCashFlows.push(cfAmount);
          twrCashFlows.push(-cfAmount);
       }
       dates.push(date);

       let marketValueAfterCf = currentCash;
       for (const [sym, shares] of Object.entries(holdings)) {
         if (shares > 0) {
           const histPrice = getHistoricalPrice(livePrices, sym, tx.date);
           const priceToUse = histPrice !== null ? histPrice : (sym === tx.symbol ? tx.price : (livePrices[sym]?.price || 0));
           marketValueAfterCf += shares * priceToUse;
         }
       }
       portfolioValues.push(marketValueAfterCf);
    }
  });

  if (targetStartMs > 0 && !hasSetInitialValue) {
    initialValue = finalValue; 
  }

  if (targetStartMs > 0 && initialValue > 0) {
    mwrCashFlows.unshift(-initialValue);
    twrCashFlows.unshift(initialValue);
    dates.unshift(new Date(targetStartMs));
    portfolioValues.unshift(initialValue);
  }

  if (twrCashFlows.length > 0) {
    twrCashFlows.push(0);
    portfolioValues.push(finalValue);
  }

  let mwr = 0;
  let twr = 0;

  try {
    if (mwrCashFlows.length >= 2) {
      const mwrInit = targetStartMs > 0 ? 0 : initialValue;
      const mwrResult = calculateMoneyWeightedReturn({
        cashFlows: mwrCashFlows,
        dates,
        finalValue,
        initialValue: mwrInit
      });
      if (mwrResult.timePeriodYears && mwrResult.timePeriodYears > 0) {
        const cumulativeMWR = Math.pow(1 + (mwrResult.mwr || 0), mwrResult.timePeriodYears) - 1;
        mwr = cumulativeMWR * 100;
      } else {
        mwr = (mwrResult.mwr || 0) * 100;
      }
    }
  } catch (e) {
    console.warn("MWR calculation bypassed or failed due to dataset limitations.");
  }

  try {
    const twrResult = calculateTimeWeightedReturn({
      portfolioValues,
      cashFlows: twrCashFlows,
      annualizationFactor: 1,
    });
    twr = (twrResult.twr || 0) * 100;
  } catch (e) {
    console.warn("TWR failed:", e);
  }

  return { mwr, twr };
}
