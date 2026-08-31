import { getServerSession } from "next-auth/next"
import { authOptions } from "../api/auth/[...nextauth]/route"
import { DashboardShell } from "@/components/dashboard-shell"
import { prisma } from "@/lib/prisma"
import { TransactionsClient } from "./transactions-client"

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions)
  
  const cashTxns = await prisma.cashTransaction.findMany({
    orderBy: { submitted_at: 'desc' },
    take: 100,
    include: { product: true }
  });

  const securityTxns = await prisma.securityTransaction.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { product: true }
  });

  // Normalize into a single shape for the client
  const allTxns = [
    ...cashTxns.map(t => ({
      id: t.id,
      reference: t.reference,
      source_name: t.source_name,
      narration: t.narration,
      direction: t.direction,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      date: t.submitted_at.toISOString(),
      type: 'cash',
      productName: t.product?.name || null
    })),
    ...securityTxns.map(t => ({
      id: t.id,
      reference: `SEC-${t.id.substring(0,6)}`,
      source_name: 'Fund Trade',
      narration: `${t.direction} ${t.units} @ ${t.price}`,
      direction: t.direction === 'BUY' ? 'outflow' : 'inflow',
      amount: t.units * t.price,
      currency: t.currency,
      status: t.status,
      date: t.created_at.toISOString(),
      type: 'security',
      productName: t.product?.name || null
    }))
  ];

  // Sort combined array descending by date
  allTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <DashboardShell
      title="Transactions"
      subtitle="Immutable ledger — reversals are posted, never edited"
    >
      <TransactionsClient initialTransactions={allTxns} />
    </DashboardShell>
  )
}
