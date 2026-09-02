const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

async function run() {
  try {
    // 1. Find Product ID
    const products = await prisma.product.findMany();
    const product = products.find(p => p.name.includes('Guaranteed Income Fund'));

    if (!product) {
      console.error('Could not find GIF(N) product');
      process.exit(1);
    }
    console.log(`Found product: ${product.name} (ID: ${product.id})`);

    // 2. Delete Existing Security Transactions
    const deleteRes = await prisma.securityTransaction.deleteMany({
      where: { product_id: product.id }
    });
    console.log(`Deleted ${deleteRes.count} existing security transactions.`);

    // 3. Parse Excel File
    const filePath = 'Trade Tracker 2022-YTD V2 (1).xlsx';
    console.log(`Reading Excel file: ${filePath}`);
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    
    // Check if 'Sheet4' or 'Sheet 4' exists
    const sheetName = workbook.SheetNames.find(name => name.trim().replace(/\s/g, '') === 'Sheet4');
    if (!sheetName) {
      console.error("Could not find 'Sheet 4' in the workbook.");
      console.error("Available sheets:", workbook.SheetNames);
      process.exit(1);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'YYYY-MM-DD' });
    
    if (data.length === 0) {
      console.error("Sheet2 is empty or could not be parsed.");
      process.exit(1);
    }

    // 4. Synchronize Instruments
    console.log(`Processing ${data.length} rows...`);
    
    const uniqueSymbols = new Map();
    for (const row of data) {
      const symbol = row[' Name of Asset']?.trim();
      if (symbol && !uniqueSymbols.has(symbol)) {
        let couponRate = null;
        if (row[' Coupon Rate']) {
          couponRate = parseFloat(row[' Coupon Rate'].toString().replace('%', ''));
        }
        uniqueSymbols.set(symbol, {
          couponRate,
          maturityDate: row[' Maturity Date'] ? new Date(row[' Maturity Date']) : null,
        });
      }
    }

    for (const [symbol, details] of uniqueSymbols.entries()) {
      const existing = await prisma.instrument.findUnique({
        where: { symbol }
      });
      if (!existing) {
        console.log(`Creating missing instrument: ${symbol}`);
        await prisma.instrument.create({
          data: {
            symbol,
            name: symbol,
            asset_class: "bond",
            currency: "NGN",
            coupon_rate: details.couponRate,
            coupon_freq: 2,
            maturity_date: details.maturityDate,
          }
        });
      }
    }

    // 5. Insert New Transactions
    const txData = data.map((row, index) => {
      try {
        const direction = (row[' Direction'] || 'BUY').toUpperCase().trim();
        const symbol = row[' Name of Asset']?.trim();
        if (!symbol) return null;
        const faceValue = parseFloat(row[' Face Value']?.toString().replace(/,/g, ''));
        const units = faceValue / 100;
        const price = parseFloat(row[' Price']?.toString().replace(/,/g, ''));
        let ytm = null;
        if (row[' Ytm'] !== undefined && row[' Ytm'] !== null && row[' Ytm'] !== '') {
           ytm = parseFloat(row[' Ytm'].toString().replace('%', '')); 
        }
        const valueDateStr = row[' Settlement Date'];
        let valueDate = new Date();
        if (valueDateStr) {
          valueDate = new Date(valueDateStr);
        }

        return {
          product_id: product.id,
          direction,
          symbol,
          units,
          price,
          ytm,
          currency: "NGN",
          value_date: valueDate,
          status: "completed"
        };
      } catch (err) {
        console.error(`Error parsing row ${index}:`, err);
        return null;
      }
    }).filter(tx => tx && tx.symbol && !isNaN(tx.units) && !isNaN(tx.price));

    console.log(`Inserting ${txData.length} valid transactions...`);
    
    const insertRes = await prisma.securityTransaction.createMany({
      data: txData
    });

    console.log(`Successfully inserted ${insertRes.count} transactions.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
