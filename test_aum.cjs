const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { ticker: 'SGEF-MCB' },
    include: { cash_transactions: true, security_transactions: true }
  });
  const product = products[0];
  
  const allSymbols = [...new Set(product.security_transactions.map(t => t.symbol).filter(Boolean))];
  const instruments = await prisma.instrument.findMany({
    where: { symbol: { in: allSymbols } },
    select: { symbol: true, market_price: true }
  });
  
  const livePrices = {};
  instruments.forEach(i => {
    livePrices[i.symbol] = { price: Number(i.market_price?.toString() || 0) };
  });

  const allTxs = [];
  product.cash_transactions.forEach(tx => {
    allTxs.push({
      date: tx.value_date.toISOString(),
      symbol: 'Cash',
      type: tx.direction === 'inflow' ? 'TXIN' : 'TXOUT',
      shares: 1,
      price: Number(tx.amount?.toString() || 0),
      fees: 0,
      amount: Number(tx.amount?.toString() || 0)
    });
  });

  product.security_transactions.forEach(tx => {
    allTxs.push({
      date: tx.value_date.toISOString(),
      symbol: tx.symbol || '',
      type: tx.direction,
      shares: Number(tx.units?.toString() || 0),
      price: Number(tx.price?.toString() || 0),
      fees: 0,
      amount: Number(tx.units?.toString() || 0) * Number(tx.price?.toString() || 0)
    });
  });

  const tsNode = require('ts-node');
  tsNode.register();
  const { calculatePositions } = require('./src/lib/equity-math.ts');

  const positions = calculatePositions(allTxs, livePrices);
  const eqValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const cash = Number(product.cash_balance?.toString() || 0);
  const aum = eqValue + cash;

  console.log('eqValue:', eqValue);
  console.log('cash:', cash);
  console.log('aum:', aum);
  console.log('original aum in DB (product.price):', product.price);
  
  // also check realizedReturn
  const totalRealizedReturn = positions.reduce((sum, h) => sum + (h.realizedReturn || 0), 0);
  console.log('totalRealizedReturn:', totalRealizedReturn);
}

main().catch(console.error).finally(() => prisma.$disconnect());
