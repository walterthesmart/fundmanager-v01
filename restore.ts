import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const productId = 'cmth76py000021czgk8o66wm0'; // GIF(₦)
  const symbol = 'FGN 2035 BOND';
  
  await prisma.securityTransaction.createMany({
    data: [
      { product_id: productId, symbol, direction: "BUY", units: 12000000, price: 103.1219, ytm: 15.2, value_date: new Date("2025-02-07"), currency: "NGN" },
      { product_id: productId, symbol, direction: "BUY", units: 8000000, price: 111.7356, ytm: 15.2, value_date: new Date("2025-02-25"), currency: "NGN" },
      { product_id: productId, symbol, direction: "BUY", units: 5000000, price: 111.5681, ytm: 15.2, value_date: new Date("2025-02-26"), currency: "NGN" },
      { product_id: productId, symbol, direction: "BUY", units: 5000000, price: 120.9364, ytm: 15.2, value_date: new Date("2025-03-04"), currency: "NGN" },
      { product_id: productId, symbol, direction: "BUY", units: 5000000, price: 129.1054, ytm: 15.2, value_date: new Date("2026-07-22"), currency: "NGN" },
      { product_id: productId, symbol, direction: "BUY", units: 5000000, price: 132.2732, ytm: 15.2, value_date: new Date("2026-07-28"), currency: "NGN" },
    ]
  });
  console.log("Restored FGN 2035 BOND transactions.");
}
run();
