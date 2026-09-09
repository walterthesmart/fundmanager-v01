import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { snapshotProductNAV, fetchLiveQuotes } from '../../../../app/actions';
import { calculatePositions, EquityTransaction } from '../../../../src/lib/equity-math';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Fetch all products
    const products = await prisma.product.findMany();
    let snappedCount = 0;

    for (const product of products) {
      // 2. Fetch required data for calculating current AUM
      const txns = await prisma.cashTransaction.findMany({
        where: { product_id: product.id },
      });
      const secTxns = await prisma.securityTransaction.findMany({
        where: { product_id: product.id },
      });

      // 3. Simple AUM Calculation for this snapshot
      let totalAUM = 0;

      if (product.asset_class === 'global_equity' || product.asset_class === 'local_equity') {
         // Equity calculation logic
         const symbols = Array.from(new Set(secTxns.map(tx => tx.symbol?.trim().toUpperCase()).filter(Boolean)));
         const liveQuotes = symbols.length > 0 ? await fetchLiveQuotes(symbols as string[]) : {};
         const livePrices: Record<string, any> = {};
         Object.keys(liveQuotes).forEach(sym => {
           livePrices[sym] = { price: liveQuotes[sym]?.price ?? 0 };
         });

         const allTxs: EquityTransaction[] = [];
         txns.forEach(tx => {
           allTxs.push({
             date: new Date(tx.value_date).toISOString(),
             symbol: "Cash",
             type: tx.direction === "inflow" ? "TXIN" : "TXOUT",
             shares: 1,
             price: tx.amount,
             fees: 0,
             amount: tx.amount
           });
         });
         secTxns.forEach(tx => {
           allTxs.push({
             date: new Date(tx.value_date).toISOString(),
             symbol: tx.symbol || "",
             type: tx.direction as any,
             shares: tx.units,
             price: tx.price,
             fees: 0,
             amount: tx.units * tx.price
           });
         });

         const positions = calculatePositions(allTxs, livePrices);
         
         const cashPos = positions.find(p => p.symbol === 'Cash' || p.symbol === 'GEF Cash');
         const computedCash = (cashPos ? cashPos.shares : 0) + product.cash_balance;
         
         const marketValue = positions.filter(p => p.symbol !== 'Cash' && p.symbol !== 'GEF Cash' && !p.isClosed).reduce((sum, p) => sum + p.currentValue, 0);
         
         totalAUM = computedCash + marketValue;
      } else {
         // Bonds NAV is tracked differently, assume product price is updated
         totalAUM = product.price; 
      }

      // 4. Save the snapshot
      await snapshotProductNAV(product.id, totalAUM);
      snappedCount++;
    }

    return NextResponse.json({ success: true, message: `Snapshotted ${snappedCount} products` });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
