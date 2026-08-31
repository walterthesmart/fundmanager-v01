"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { fetchProductHistory, fetchProductTransactions, fetchSecurityTransactions } from "../../app/actions";
import { format } from "date-fns";

interface ProductChartModalProps {
  productId: string;
  productName: string;
  productCurrency?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductChartModal({ productId, productName, productCurrency = "USD", isOpen, onClose }: ProductChartModalProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [securityTransactions, setSecurityTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "transactions" | "security">("chart");

  useEffect(() => {
    if (isOpen && productId) {
      setLoading(true);
      Promise.all([
        fetchProductHistory(productId),
        fetchProductTransactions(productId),
        fetchSecurityTransactions(productId),
      ])
        .then(([history, txns, secTxns]) => {
          const data = history.map((h) => ({
            date: format(new Date(h.occurred_at), "MMM d, yy"),
            nav: h.new_price,
          }));
          setChartData(data);
          setTransactions(txns);
          setSecurityTransactions(secTxns);
        })
        .finally(() => setLoading(false));
    } else {
      setChartData([]);
      setTransactions([]);
      setSecurityTransactions([]);
      setActiveTab("chart");
    }
  }, [isOpen, productId]);

  // Aggregate current holdings from security transactions
  const currentHoldings = useMemo(() => {
    // Map keyed by uppercase symbol to handle case inconsistencies (e.g. "Bond" vs "bond")
    const holdings = new Map<string, { displayKey: string; units: number; totalCost: number }>();
    
    securityTransactions.forEach(tx => {
      const rawSymbol = tx.symbol || "Unknown";
      const key = rawSymbol.trim().toUpperCase();
      
      const current = holdings.get(key) || { displayKey: rawSymbol, units: 0, totalCost: 0 };
      
      if (tx.direction === "BUY") {
        current.units += Number(tx.units);
        current.totalCost += (Number(tx.units) * Number(tx.price)) / 100; // assuming Nigerian convention
      } else if (tx.direction === "SELL") {
        current.units -= Number(tx.units);
        current.totalCost -= (Number(tx.units) * Number(tx.price)) / 100;
      }
      
      holdings.set(key, current);
    });
    
    return Array.from(holdings.values())
      .filter((data) => data.units > 0.01) // Handle tiny floating point diffs
      .map((data) => ({
        name: data.displayKey,
        units: data.units,
        avgPrice: data.totalCost / (data.units / 100),
        value: data.totalCost
      }));
  }, [securityTransactions]);

  // Compute cash balance
  const currentCash = useMemo(() => {
    let cash = 0;
    transactions.forEach(tx => {
      if (tx.direction === "inflow") cash += Number(tx.amount);
      else if (tx.direction === "outflow") cash -= Number(tx.amount);
    });
    return cash;
  }, [transactions]);

  const totalHoldingsValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
  const totalAUM = totalHoldingsValue + currentCash;

  const symbol = productCurrency === "NGN" ? "₦" : "$";
  const formatCurrency = (val: number) => `${symbol}${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  const formatAxisCurrency = (val: number) => {
    if (val >= 1e9) return `${symbol}${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `${symbol}${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `${symbol}${(val / 1e3).toFixed(1)}K`;
    return `${symbol}${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-border mt-1">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "chart"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeTab === "chart" ? { borderBottomColor: "#93CDC5" } : {}}
            onClick={() => setActiveTab("chart")}
          >
            NAV Trajectory
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "transactions"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeTab === "transactions" ? { borderBottomColor: "#93CDC5" } : {}}
            onClick={() => setActiveTab("transactions")}
          >
            Subscriptions & Redemptions
            {transactions.length > 0 && (
              <span className="ml-2 text-xs bg-muted px-1.5 py-0.5">{transactions.length}</span>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "security"
                ? "border-b-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeTab === "security" ? { borderBottomColor: "#93CDC5" } : {}}
            onClick={() => setActiveTab("security")}
          >
            Security Transactions
            {securityTransactions.length > 0 && (
              <span className="ml-2 text-xs bg-muted px-1.5 py-0.5">{securityTransactions.length}</span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="w-full h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground animate-pulse">Loading…</p>
          </div>
        ) : activeTab === "chart" ? (
          /* ── Chart Tab ── */
          <div className="flex-1 overflow-auto mt-2">
            <div className="h-[300px] w-full">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No historical data available.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#93CDC5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#93CDC5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickMargin={10}
                      minTickGap={40}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={formatAxisCurrency}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0px",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "NAV / Unit"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="nav"
                      stroke="#0B1D40"
                      strokeWidth={2}
                      fill="url(#navGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#0B1D40", stroke: "#93CDC5", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Current Holdings Section */}
            {(currentHoldings.length > 0 || currentCash !== 0) && (
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Fund Composition (AUM)</h4>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2 px-3 font-medium">Instrument</th>
                      <th className="py-2 px-3 font-medium text-right">Units Held</th>
                      <th className="py-2 px-3 font-medium text-right">Est. Avg Price</th>
                      <th className="py-2 px-3 font-medium text-right">Book Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentHoldings.map((h, i) => (
                      <tr key={h.name} className="border-b border-border/50">
                        <td className="py-2 px-3 font-medium text-xs">{h.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {h.units.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {formatCurrency(h.avgPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {formatCurrency(h.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/10 font-semibold text-xs border-t-2 border-border">
                    <tr>
                      <td className="py-2 px-3 text-muted-foreground">Total Bonds</td>
                      <td className="py-2 px-3" colSpan={2}></td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(totalHoldingsValue)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-muted-foreground">Cash Balance</td>
                      <td className="py-2 px-3" colSpan={2}></td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(currentCash)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-3 px-3 text-sm text-foreground">Total AUM</td>
                      <td className="py-3 px-3" colSpan={2}></td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-primary">{formatCurrency(totalAUM)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "transactions" ? (
          /* ── Cash Transactions Tab ── */
          <div className="flex-1 overflow-auto mt-2" style={{ maxHeight: "440px" }}>
            {transactions.length === 0 ? (
              <div className="w-full h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground">No transactions recorded.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Source</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium text-right">Amount (₦)</th>
                    <th className="py-2 px-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      <td className="py-2 px-3 text-xs whitespace-nowrap">
                        {format(new Date(tx.value_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-2 px-3 text-xs font-medium">
                        {tx.client?.name || tx.source_name || "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 ${
                            tx.direction === "inflow"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {tx.direction === "inflow" ? "Inflow" : "Outflow"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-right font-mono">
                        {tx.direction === "outflow" && "−"}
                        ₦{Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[200px]">
                        {tx.narration || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* ── Security Transactions Tab ── */
          <div className="flex-1 overflow-auto mt-2" style={{ maxHeight: "440px" }}>
            {securityTransactions.length === 0 ? (
              <div className="w-full h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground">No security transactions recorded.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium text-right">Units</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {securityTransactions.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                    >
                      <td className="py-2 px-3 text-xs whitespace-nowrap">
                        {format(new Date(tx.value_date), "MMM d, yyyy")}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 ${
                            tx.direction === "BUY"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {tx.direction}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-right font-mono">
                        {Number(tx.units).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-xs text-right font-mono">
                        ₦{Number(tx.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
