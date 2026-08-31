import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Wallet,
  Users,
  Package,
  BellRing,
} from "lucide-react";
import { getServerSession } from "next-auth/next";

import { DashboardShell } from "@/components/dashboard-shell";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ASSET_CLASSES, valueHoldings } from "@/lib/wealth-data";
import { CURRENCY_RATES } from "@/lib/display-currency";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  // Data Fetching
  const clients = await prisma.client.findMany();
  const products = await prisma.product.findMany();
  const holdings = await prisma.clientHolding.findMany();
  const cash = await prisma.cashTransaction.findMany();
  
  // In a real scenario we'd fetch accounts and transactions from QuickBooks equivalent
  // For the demo we simulate them
  const accounts = [] as any[];
  const transactions = [] as any[];

  const toUsd = (value: number | string | null, currency = "USD") =>
    Number(value ?? 0) / (CURRENCY_RATES[currency] ?? 1);

  const valued = valueHoldings(holdings as any, products as any);

  const portfolioAum = valued.reduce((s, v) => s + v.marketValue, 0);
  const cost = valued.reduce((s, v) => s + v.cost, 0);
  const gainPct = cost > 0 ? ((portfolioAum - cost) / cost) * 100 : 0;
  const clientCash = clients.reduce((s, c) => s + toUsd(c.cash_balance, c.currency), 0);
  const treasury = accounts.reduce((s, a) => s + toUsd(a.balance, a.currency), 0);
  const totalAum = portfolioAum + clientCash + treasury;

  const inflow = transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + toUsd(t.amount, t.currency), 0);
  const outflow = transactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + toUsd(t.amount, t.currency), 0);
  const verified = accounts.filter((a) => a.is_verified).length;

  const pendingCash = cash.filter(
    (c) => c.status === "pending_review" || c.status === "pending_approval",
  );

  const allocation = ASSET_CLASSES.map((ac) => {
    const value = valued
      .filter((v) => v.product.asset_class === ac.value)
      .reduce((s, v) => s + v.marketValue, 0);
    return { ...ac, value, pct: portfolioAum > 0 ? (value / portfolioAum) * 100 : 0 };
  })
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value);

  const topClients = clients
    .map((client) => ({
      client,
      aum: valued
        .filter((v) => v.holding.client_id === client.id)
        .reduce((s, v) => s + v.marketValue, 0),
    }))
    .sort((a, b) => b.aum - a.aum)
    .slice(0, 6);

  const movers = products
    .filter((p) => p.previous_price && Number(p.previous_price) > 0)
    .map((p) => ({
      product: p,
      change: ((Number(p.price) - Number(p.previous_price)) / Number(p.previous_price)) * 100,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
    
  const formatMoney = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <DashboardShell
      title="Fund Overview"
      subtitle="Balances settle in under a second of commit"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="AUM"
          value={formatMoney(totalAum)}
          hint={`${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}% vs cost`}
          icon={<Wallet className="size-4" />}
          highlight
        />
        <StatCard
          label="Clients"
          value={`${clients.length}`}
          hint={`${clients.filter((c) => c.client_type === "corporate").length} corporate`}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Products"
          value={`${products.length}`}
          hint={`${allocation.length} asset classes live`}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Pending approvals"
          value={`${pendingCash.length}`}
          hint="cash awaiting maker-checker"
          icon={<BellRing className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Recent inflow"
          value={formatMoney(inflow)}
          icon={<ArrowDownLeft className="size-4" />}
        />
        <StatCard
          label="Recent outflow"
          value={formatMoney(outflow)}
          icon={<ArrowUpRight className="size-4" />}
        />
        <StatCard
          label="Verified accounts"
          value={`${verified} of ${accounts.length}`}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel rise-in p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Latest ledger activity</h2>
            <Badge variant="secondary" className="rounded-none">
              <span className="pulse-dot mr-1.5 inline-block size-1.5 rounded-full bg-mint" />
              <Activity className="mr-1 size-3" /> live
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Transaction list temporarily disabled during migration.</p>
        </section>

        <section className="panel rise-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Asset allocation</h2>
          <div className="space-y-3">
            {allocation.map((a) => (
              <div key={a.value} className="group">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{a.label}</span>
                  <span className="text-numeric shrink-0 text-muted-foreground">
                    {a.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-secondary">
                  <div
                    className="h-full bg-mint transition-[width] duration-700 ease-out group-hover:opacity-80"
                    style={{ width: `${Math.max(a.pct, 1)}%` }}
                  />
                </div>
                <p className="text-numeric mt-1 text-[11px] text-muted-foreground">
                  {formatMoney(a.value)}
                </p>
              </div>
            ))}
            {allocation.length === 0 && (
              <p className="text-sm text-muted-foreground">No holdings valued yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel rise-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Top clients by AUM</h2>
          <div className="divide-y divide-border">
            {topClients.map((row) => (
              <Link
                key={row.client.id}
                href={`/clients/${row.client.id}`}
                className="accent-rail flex items-center justify-between gap-3 py-2.5 pl-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.client.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.client.identifier} · {row.client.client_type}
                  </p>
                </div>
                <p className="text-numeric shrink-0 text-sm font-semibold">
                  {formatMoney(row.aum)}
                </p>
              </Link>
            ))}
            {topClients.length === 0 && (
              <p className="text-sm text-muted-foreground">No clients yet.</p>
            )}
          </div>
        </section>

        <section className="panel rise-in p-5">
          <h2 className="mb-4 text-sm font-semibold">Price movers</h2>
          <div className="divide-y divide-border">
            {movers.map((m) => (
              <div key={m.product.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.product.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.product.ticker} · {m.product.price_mode}
                  </p>
                </div>
                <p
                  className={`text-numeric shrink-0 text-sm font-semibold ${
                    m.change >= 0 ? "text-mint-foreground" : "text-destructive"
                  }`}
                >
                  {m.change >= 0 ? "+" : ""}
                  {m.change.toFixed(2)}%
                </p>
              </div>
            ))}
            {movers.length === 0 && (
              <p className="text-sm text-muted-foreground">No price history yet.</p>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`panel lift rise-in p-5 ${highlight ? "ring-1 ring-mint" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="truncate text-xs font-medium uppercase tracking-[0.12em]">{label}</span>
        <span className="grid size-8 shrink-0 place-items-center bg-secondary text-secondary-foreground transition-colors duration-200">
          {icon}
        </span>
      </div>
      <p className="text-numeric mt-3 truncate text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
