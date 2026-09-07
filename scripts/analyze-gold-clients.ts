import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing Gold Fund Client Performance...");

  const goldFund = await prisma.product.findUnique({ where: { ticker: "SGF-IAU" } });
  if (!goldFund) {
    throw new Error("Sankore Gold Fund product not found. Ensure it is seeded.");
  }

  // Find all cash transactions for this fund
  const cashTxs = await prisma.cashTransaction.findMany({
    where: { product_id: goldFund.id, status: "approved" },
    include: { client: true },
    orderBy: { value_date: "asc" }
  });

  const clientStats: Record<string, { name: string, totalInflow: number, totalOutflow: number, currentUnits: number }> = {};

  let totalFundSubscriptions = 0;
  let totalFundRedemptions = 0;

  for (const tx of cashTxs) {
    if (!tx.client_id || !tx.client) continue;
    
    const clientId = tx.client_id;
    if (!clientStats[clientId]) {
      clientStats[clientId] = {
        name: tx.client.name,
        totalInflow: 0,
        totalOutflow: 0,
        currentUnits: 0,
      };
    }

    if (tx.direction === "inflow") {
      clientStats[clientId].totalInflow += tx.amount;
      clientStats[clientId].currentUnits += (tx.amount / 100);
      totalFundSubscriptions += tx.amount;
    } else if (tx.direction === "outflow") {
      clientStats[clientId].totalOutflow += tx.amount;
      clientStats[clientId].currentUnits -= (tx.amount / 100);
      totalFundRedemptions += tx.amount;
    }
  }

  // Generate markdown report
  let md = `# Sankore Gold Fund Client Performance\n\n`;
  md += `**Closing NAV:** 100 USD\n`;
  md += `**Total Subscriptions:** $${totalFundSubscriptions.toLocaleString()}\n`;
  md += `**Total Redemptions:** $${totalFundRedemptions.toLocaleString()}\n\n`;

  md += `| Client | Total Subscriptions ($) | Total Redemptions ($) | Remaining Units | Current Value ($) | Net Profit ($) |\n`;
  md += `|---|---|---|---|---|---|\n`;

  let totalValue = 0;
  let totalProfit = 0;

  for (const clientId in clientStats) {
    const stats = clientStats[clientId];
    const currentValue = stats.currentUnits * 100;
    const netProfit = currentValue + stats.totalOutflow - stats.totalInflow;
    
    totalValue += currentValue;
    totalProfit += netProfit;

    md += `| ${stats.name} | ${stats.totalInflow.toLocaleString(undefined, {minimumFractionDigits: 2})} | ${stats.totalOutflow.toLocaleString(undefined, {minimumFractionDigits: 2})} | ${stats.currentUnits.toLocaleString(undefined, {minimumFractionDigits: 2})} | ${currentValue.toLocaleString(undefined, {minimumFractionDigits: 2})} | ${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})} |\n`;
  }

  md += `| **TOTAL** | **${totalFundSubscriptions.toLocaleString(undefined, {minimumFractionDigits: 2})}** | **${totalFundRedemptions.toLocaleString(undefined, {minimumFractionDigits: 2})}** | **${(totalValue/100).toLocaleString(undefined, {minimumFractionDigits: 2})}** | **${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}** | **${totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}** |\n`;

  // Write as an artifact
  const reportPath = "C:\\Users\\nwaug\\.gemini\\antigravity-ide\\brain\\f4f9a758-b4d1-46df-ae09-a010e1ec1c79\\gold_fund_client_performance.md";
  fs.writeFileSync(reportPath, md);
  console.log(`Generated report at ${reportPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
