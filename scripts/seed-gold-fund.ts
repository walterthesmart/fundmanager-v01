import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import yahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Sankore Gold Fund...");

  // 1. Create the Product
  let goldFund = await prisma.product.findUnique({ where: { ticker: 'SGF-IAU' } });
  
  if (!goldFund) {
    console.log("Creating Gold Fund Product...");
    goldFund = await prisma.product.create({
      data: {
        name: 'Sankore Gold Fund',
        ticker: 'SGF-IAU',
        asset_class: 'alternatives',
        currency: 'USD',
        price_mode: 'automated',
        price_source: 'yahoo-finance',
      }
    });
  }

  // 2. Fetch live price
  try {
    console.log("Fetching live price for IAU from Yahoo Finance...");
    const quote = await yahooFinance.quote('IAU');
    if (quote && quote.regularMarketPrice) {
      await prisma.product.update({
        where: { id: goldFund.id },
        data: {
          previous_price: goldFund.price,
          price: quote.regularMarketPrice,
          price_updated_at: new Date()
        }
      });
      console.log(`Updated IAU price to $${quote.regularMarketPrice}`);
    }
  } catch (error) {
    console.error("Failed to fetch price from Yahoo Finance:", error);
  }

  // 3. Clear old transactions for this fund
  console.log("Clearing existing dummy transactions for Gold Fund...");
  await prisma.cashTransaction.deleteMany({ where: { product_id: goldFund.id } });
  await prisma.securityTransaction.deleteMany({ where: { product_id: goldFund.id } });

  // 4. Ingest Gold Fund Cash.csv
  const cashCsvPath = path.join(process.cwd(), 'Gold Fund Cash.csv');
  if (fs.existsSync(cashCsvPath)) {
    console.log("Reading Gold Fund Cash.csv...");
    const cashData = fs.readFileSync(cashCsvPath, 'utf8');
    const cashRecords = parse(cashData, { columns: true, skip_empty_lines: true });

    for (const record of cashRecords) {
      const memo = record.MEMO || "";
      let clientName = null;
      let direction = record.TRAN === 'TXIN' ? 'inflow' : 'outflow';
      
      if (memo.includes("Subscription")) {
        clientName = memo.replace("- Subscription", "").trim();
        direction = "inflow";
      } else if (memo.includes("Redemption")) {
        clientName = memo.replace("- Redemption", "").trim();
        direction = "outflow";
      } else {
        clientName = memo;
      }

      // Ensure client exists
      let clientRecord = null;
      if (clientName && !memo.includes("Transfer of") && !memo.includes("Reclassification") && !memo.includes("Derecognition") && !memo.includes("Recognition of")) {
        clientRecord = await prisma.client.findUnique({ where: { identifier: clientName.toLowerCase().replace(/\s+/g, '-') } });
        if (!clientRecord) {
          clientRecord = await prisma.client.create({
            data: {
              name: clientName,
              identifier: clientName.toLowerCase().replace(/\s+/g, '-'),
              client_type: clientName.includes("Limited") || clientName.includes("Capitaux") ? "corporate" : "individual",
              status: "active"
            }
          });
        }
      }

      const amount = parseFloat(record.BNUM || "0");
      if (isNaN(amount) || amount === 0) continue;

      // Parse date yyyymmdd
      const dateStr = record.ED;
      let valueDate = new Date();
      if (dateStr && dateStr.length === 8) {
        valueDate = new Date(`${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`);
      }

      await prisma.cashTransaction.create({
        data: {
          client_id: clientRecord?.id || null,
          product_id: goldFund.id,
          source_name: clientName,
          narration: memo,
          amount: amount,
          currency: record.CURRENCY || "USD",
          direction: direction,
          reference: `CASH-${dateStr}-${Math.random().toString(36).substring(7)}`,
          status: "approved",
          value_date: valueDate,
        }
      });
    }
    console.log(`Imported ${cashRecords.length} cash transactions.`);
  }

  // 5. Ingest Gold Fund Transactions.csv
  const txCsvPath = path.join(process.cwd(), 'Gold Fund Transactions.csv');
  if (fs.existsSync(txCsvPath)) {
    console.log("Reading Gold Fund Transactions.csv...");
    const txData = fs.readFileSync(txCsvPath, 'utf8');
    const txRecords = parse(txData, { columns: true, skip_empty_lines: true });

    for (const record of txRecords) {
      if (!record.TRAN) continue;
      
      const units = parseFloat(record.BNUM || "0");
      const price = parseFloat(record.ANUM || "0");
      
      if (isNaN(units) || units === 0) continue;

      const dateStr = record.ED;
      let valueDate = new Date();
      if (dateStr && dateStr.length === 8) {
        valueDate = new Date(`${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`);
      }

      await prisma.securityTransaction.create({
        data: {
          product_id: goldFund.id,
          direction: record.TRAN, // BUY / SELL
          units: units,
          price: price,
          value_date: valueDate,
        }
      });
    }
    console.log(`Imported ${txRecords.length} security transactions.`);
  }

  console.log("Done seeding.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
