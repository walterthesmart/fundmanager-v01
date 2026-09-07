import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sadf = await prisma.product.findUnique({ where: { ticker: "SADF" } });
  if (!sadf) return console.log("SADF not found");

  const txns = await prisma.securityTransaction.findMany({ where: { product_id: sadf.id } });
  console.log("SADF Transactions:");
  console.table(txns.map(t => ({
    symbol: t.symbol,
    dir: t.direction,
    units: t.units,
    price: t.price,
    ytm: t.ytm
  })));
  
  const instruments = await prisma.instrument.findMany();
  console.log("Instruments:");
  console.table(instruments.filter(i => txns.some(t => t.symbol === i.symbol)).map(i => ({
    symbol: i.symbol,
    coupon: i.coupon_rate,
    maturity: i.maturity_date
  })));
}

main().finally(() => prisma.$disconnect());
