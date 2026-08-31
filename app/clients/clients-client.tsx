'use client'

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileSpreadsheet, LayoutGrid, List, Search, User } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { ASSET_CLASSES, valueHoldings } from "@/lib/wealth-data";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useDisplayCurrency } from "@/lib/display-currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ClientsClient({ initialClients, initialHoldings, initialProducts }: { initialClients: any[], initialHoldings: any[], initialProducts: any[] }) {
  const { format: formatMoney } = useDisplayCurrency();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const rows = useMemo(() => {
    const valued = valueHoldings(initialHoldings, initialProducts);
    return initialClients
      .map((client) => {
        const mine = valued.filter((v) => v.holding.client_id === client.id);
        const aum = mine.reduce((s, v) => s + v.marketValue, 0);
        const cost = mine.reduce((s, v) => s + v.cost, 0);
        const gain = aum - cost;
        return {
          client,
          aum,
          cash: Number(client.cash_balance),
          gain,
          gainPct: cost > 0 ? (gain / cost) * 100 : 0,
          classes: new Set(mine.map((v) => v.product.asset_class)),
        };
      })
      .filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          r.client.name.toLowerCase().includes(q) ||
          r.client.identifier.toLowerCase().includes(q) ||
          (r.client.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.aum - a.aum);
  }, [initialClients, initialHoldings, initialProducts, search]);

  const totalAum = rows.reduce((s, r) => s + r.aum, 0);
  const totalCash = rows.reduce((s, r) => s + r.cash, 0);

  const report = () =>
    downloadCsv(
      `sankore-clientele-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        ["Client", "Identifier", "Type", "Country", "AUM", "Cash", "Unrealised gain", "Gain %"],
        ...rows.map((r) => [
          r.client.name,
          r.client.identifier,
          r.client.client_type,
          r.client.country ?? "",
          r.aum.toFixed(2),
          r.cash.toFixed(2),
          r.gain.toFixed(2),
          r.gainPct.toFixed(2),
        ]),
      ]),
    );

  const tabbed = (type: "all" | "individual" | "corporate") =>
    rows.filter((r) => type === "all" || r.client.client_type === type);

  return (
    <DashboardShell
      title="Clientele"
      subtitle={`${initialClients.length} clients · ${formatMoney(totalAum)} AUM · ${formatMoney(totalCash)} cash`}
      actions={
        <Button size="sm" variant="outline" className="rounded-none" onClick={report}>
          <FileSpreadsheet className="mr-1.5 size-4" />
          <span className="hidden sm:inline">Generate report</span>
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search client name, identifier or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex shrink-0 items-center border border-border">
          {(["list", "grid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`${v} view`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`press flex items-center gap-1.5 px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "list" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
              <span className="hidden sm:inline">{v}</span>
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="individual">Individuals</TabsTrigger>
          <TabsTrigger value="corporate">Corporates</TabsTrigger>
        </TabsList>

        {(["all", "individual", "corporate"] as const).map((type) => (
          <TabsContent key={type} value={type}>
            {tabbed(type).length === 0 ? (
              <p className="panel p-10 text-center text-sm text-muted-foreground">
                No clients match that search.
              </p>
            ) : view === "grid" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tabbed(type).map((r) => (
                  <Link
                    key={r.client.id}
                    href={`/clients/${r.client.id}`}
                    className="panel lift rise-in p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.client.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.client.identifier} · {r.client.country ?? "—"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                        {r.client.client_type === "corporate" ? (
                          <Building2 className="mr-1 size-3" />
                        ) : (
                          <User className="mr-1 size-3" />
                        )}
                        {r.client.client_type}
                      </Badge>
                    </div>
                    <p className="text-numeric mt-3 text-lg font-semibold">{formatMoney(r.aum)}</p>
                    <p className="text-xs text-muted-foreground">
                      cash {formatMoney(r.cash, r.client.currency)} ·{" "}
                      <span className={r.gain >= 0 ? "text-mint-foreground" : "text-destructive"}>
                        {r.gain >= 0 ? "+" : ""}
                        {r.gainPct.toFixed(2)}%
                      </span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {ASSET_CLASSES.filter((ac) => r.classes.has(ac.value)).map((ac) => (
                        <span
                          key={ac.value}
                          className="bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                        >
                          {ac.label}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <>
                <div className="panel divide-y divide-border lg:hidden">
                  {tabbed(type).map((r) => (
                    <Link
                      key={r.client.id}
                      href={`/clients/${r.client.id}`}
                      className="accent-rail flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.client.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.client.identifier} · {r.client.client_type}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-numeric text-sm font-semibold">{formatMoney(r.aum)}</p>
                        <p
                          className={`text-xs ${r.gain >= 0 ? "text-mint-foreground" : "text-destructive"}`}
                        >
                          {r.gain >= 0 ? "+" : ""}
                          {r.gainPct.toFixed(2)}%
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="panel hidden overflow-hidden lg:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Identifier</th>
                        <th className="px-4 py-3 font-medium">Type</th>
                        <th className="px-4 py-3 font-medium">Asset classes</th>
                        <th className="px-4 py-3 text-right font-medium">AUM</th>
                        <th className="px-4 py-3 text-right font-medium">Cash</th>
                        <th className="px-4 py-3 text-right font-medium">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tabbed(type).map((r) => (
                        <tr
                          key={r.client.id}
                          className="group transition-colors hover:bg-muted/50"
                        >
                          <td className="max-w-[220px] px-4 py-3">
                            <Link
                              href={`/clients/${r.client.id}`}
                              className="underline-sweep block truncate font-medium"
                            >
                              {r.client.name}
                            </Link>
                            <span className="block truncate text-xs text-muted-foreground">
                              {r.client.country ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.client.identifier}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {r.client.client_type === "corporate" ? (
                                <Building2 className="mr-1 size-3" />
                              ) : (
                                <User className="mr-1 size-3" />
                              )}
                              {r.client.client_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {ASSET_CLASSES.filter((ac) => r.classes.has(ac.value)).map((ac) => (
                                <span
                                  key={ac.value}
                                  className="bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                                >
                                  {ac.label}
                                </span>
                              ))}
                              {r.classes.size === 0 && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="text-numeric px-4 py-3 text-right font-semibold">
                            {formatMoney(r.aum)}
                          </td>
                          <td className="text-numeric px-4 py-3 text-right">
                            {formatMoney(r.cash, r.client.currency)}
                          </td>
                          <td
                            className={`text-numeric px-4 py-3 text-right ${
                              r.gain >= 0 ? "text-mint-foreground" : "text-destructive"
                            }`}
                          >
                            {r.gain >= 0 ? "+" : ""}
                            {r.gainPct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </DashboardShell>
  );
}
