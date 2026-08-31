'use client'

import { useDisplayCurrency } from "@/lib/display-currency";
import { format } from "date-fns";

export function TransactionsClient({ initialTransactions }: { initialTransactions: any[] }) {
  const { format: formatMoney } = useDisplayCurrency();

  return (
    <>
      <section className="panel hidden overflow-hidden lg:block mt-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Direction</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initialTransactions.map((txn) => (
              <tr key={txn.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">
                  {txn.reference}
                  {txn.productName === 'Sankore Gold Fund' && (
                    <span className="ml-2 inline-flex items-center rounded-md bg-yellow-400/20 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                      Gold
                    </span>
                  )}
                  {txn.type === 'security' && (
                    <span className="ml-2 inline-flex items-center rounded-md bg-blue-400/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      Trade
                    </span>
                  )}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3">
                  {txn.source_name || txn.narration || "—"}
                </td>
                <td className="px-4 py-3 capitalize">{txn.direction}</td>
                <td className="text-numeric px-4 py-3 text-right">
                  {txn.direction === "inflow" ? "+" : "−"}
                  {formatMoney(txn.amount, txn.currency)}
                </td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{txn.status.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(txn.date), "PPp")}
                </td>
              </tr>
            ))}
            {initialTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No transactions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
