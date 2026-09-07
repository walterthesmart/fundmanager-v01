import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mappings from the Email symbol to Database symbol
// E.g. "REPUBLIC OF NIGERIA NOV 2027" -> "NGERIA 8.375 11/27" (or whatever the DB has)
const SYMBOL_MAPPING: Record<string, string> = {
  // TODO: Add mappings if the n8n data doesn't exactly match the db symbols.
  // "REPUBLIC OF NIGERIA NOV 2027": "NGERIA 27",
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // In production, ensure process.env.WEBHOOK_SECRET is set
    // You will need to add WEBHOOK_SECRET to your .env file
    const secret = process.env['WEBHOOK_SECRET'] || "fallback_secret_for_development";
    
    if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.split(" ")[1] !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prices } = body;

    if (!prices || !Array.isArray(prices)) {
      return NextResponse.json({ error: "Invalid payload format. Expected { prices: [...] }" }, { status: 400 });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const item of prices) {
      if (!item.symbol || item.bidPx == null || item.askPx == null) {
        errors.push(`Missing symbol or prices for one of the entries`);
        continue;
      }

      // 1. Resolve Symbol
      const dbSymbol = SYMBOL_MAPPING[item.symbol] || item.symbol;

      // 2. Calculate Mid Price and Mid Yield
      const midPrice = (parseFloat(item.bidPx) + parseFloat(item.askPx)) / 2;
      
      let midYield = null;
      if (item.bidYield != null && item.askYield != null) {
        midYield = (parseFloat(item.bidYield) + parseFloat(item.askYield)) / 2;
      }

      // 3. Update the Instrument in the database
      try {
        const instrument = await prisma.instrument.findFirst({
          where: { symbol: dbSymbol },
        });

        if (instrument) {
          await prisma.instrument.update({
            where: { id: instrument.id },
            data: {
              market_price: midPrice,
              market_ytm: midYield,
            },
          });
          updatedCount++;
        } else {
          errors.push(`Instrument not found in database: ${dbSymbol}`);
        }
      } catch (err: any) {
        errors.push(`Failed to update ${dbSymbol}: ${err.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully updated ${updatedCount} instruments`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
