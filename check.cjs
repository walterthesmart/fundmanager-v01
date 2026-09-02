const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.securityTransaction.findMany();
  const instruments = await prisma.instrument.findMany();
  
  const positions = {};
  
  txs.forEach(tx => {
    if (!tx.symbol) return;
    const sym = tx.symbol.trim().toUpperCase();
    if (!positions[sym]) positions[sym] = { units: 0, buys: 0, sells: 0 };
    
    if (tx.direction === "BUY") {
       positions[sym].units += tx.units;
       positions[sym].buys++;
    } else {
       positions[sym].units -= tx.units;
       positions[sym].sells++;
    }
  });

  const closed = Object.keys(positions).filter(k => Math.abs(positions[k].units) < 0.01);
  console.log("Positions that were closed out by selling:");
  closed.forEach(c => console.log(c, positions[c]));
  
  const mature = instruments.filter(i => i.maturity_date && new Date(i.maturity_date) < new Date()).map(i => i.symbol.trim().toUpperCase());
  
  const unclosedMature = mature.filter(m => positions[m] && Math.abs(positions[m].units) >= 0.01);
  console.log("\nPositions that matured but were never sold:");
  unclosedMature.forEach(m => console.log(m, positions[m]));

}

main().catch(console.error).finally(() => prisma.$disconnect());
