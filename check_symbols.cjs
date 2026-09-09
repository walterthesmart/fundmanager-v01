const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({
    where: { ticker: 'SGEF-MCB' },
    include: { security_transactions: true }
  });
  const product = products[0];
  const allSymbols = [...new Set(product.security_transactions.map(t => t.symbol).filter(Boolean))];
  const instruments = await prisma.instrument.findMany({
    where: { symbol: { in: allSymbols } },
    select: { symbol: true, market_price: true }
  });
  const foundSymbols = instruments.map(i => i.symbol);
  const missingSymbols = allSymbols.filter(s => !foundSymbols.includes(s));
  
  console.log("All Symbols length:", allSymbols.length);
  console.log("Found Symbols length:", foundSymbols.length);
  console.log("Missing Symbols:", missingSymbols);

  const missingPrices = instruments.filter(i => i.market_price == null || Number(i.market_price) === 0);
  console.log("Instruments with missing or 0 price:", missingPrices.map(i => i.symbol));
}
main().catch(console.error).finally(() => prisma.$disconnect());
