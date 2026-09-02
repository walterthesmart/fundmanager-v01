import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { DashboardShell } from "@/components/dashboard-shell"
import { prisma } from "@/lib/prisma"
import { ClientsClient } from "./clients-client"

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)
  
  const clients = await prisma.client.findMany()
  const holdings = await prisma.clientHolding.findMany()
  const products = await prisma.product.findMany()

  return (
    <ClientsClient 
      initialClients={clients} 
      initialHoldings={holdings} 
      initialProducts={products} 
    />
  )
}
