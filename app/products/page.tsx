import { getServerSession } from "next-auth/next"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { ProductsClient } from "./products-client"

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  
  const products = await prisma.product.findMany({
    include: {
      cash_transactions: true,
      security_transactions: true,
    },
    orderBy: [
      { asset_class: 'asc' },
      { name: 'asc' }
    ]
  })

  const productsWithAum = products.map(product => {
    let cash = 0;
    product.cash_transactions.forEach(tx => {
      if (tx.direction === "inflow") cash += tx.amount;
      else if (tx.direction === "outflow") cash -= tx.amount;
    });
    
    let bondValue = 0;
    product.security_transactions.forEach(tx => {
      if (tx.direction === "BUY") {
         bondValue += (Number(tx.units) * Number(tx.price)) / 100;
      } else if (tx.direction === "SELL") {
         bondValue -= (Number(tx.units) * Number(tx.price)) / 100;
      }
    });

    const aum = cash + bondValue;
    const { cash_transactions, security_transactions, ...rest } = product;
    
    // For GUI, we can default aum to 0 if no transactions exist, 
    // but let's just expose it on the object
    return { ...rest, aum: aum > 0 ? aum : (product.price || 0) };
  });

  return <ProductsClient initialProducts={productsWithAum} userId={session?.user?.id} />
}
