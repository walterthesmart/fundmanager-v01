"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { fetchProductHistory, fetchProductTransactions, fetchSecurityTransactions, fetchInstruments, upsertInstrument, createSecurityTransaction, deleteSecurityTransaction } from "../../app/actions";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { calculateAccruedInterest, calculateYTM, calculateDirtyPriceFromYTM, calculateCleanPrice, calculateTotalConsideration, getNextCouponDate, getPreviousCouponDate, calculateCouponsReceived, isZeroCoupon, calculateTBillPrice, calculateTBillYield, calculateTBillConsideration } from "../lib/bond-math";
import { generateHistoricalAUM } from "../lib/historical-chart";

interface ProductChartModalProps {
  productId: string;
  productName: string;
  productCurrency?: string;
  productCashBalance?: number;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onRequestEdit?: () => void;
}

export function ProductChartModal({ productId, productName, productCurrency = "USD", productCashBalance = 0, isOpen, onClose, onRefresh, onRequestEdit }: ProductChartModalProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [securityTransactions, setSecurityTransactions] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [editingInstrument, setEditingInstrument] = useState<any>(null);
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "transactions" | "security">("chart");
  const [isBuyingNewInstrument, setIsBuyingNewInstrument] = useState(false);

  const refreshTransactionsAndInstruments = async () => {
    if (productId) {
      const secTxns = await fetchSecurityTransactions(productId);
      setSecurityTransactions(secTxns);
      
      const symbols = Array.from(new Set(secTxns.map((tx: any) => tx.symbol?.trim().toUpperCase()).filter(Boolean)));
      if (symbols.length > 0) {
        const insts = await fetchInstruments(symbols as string[]);
        setInstruments(insts);
      }
      if (onRefresh) onRefresh();
    }
  };

  const refreshInstruments = async () => {
    const symbols = Array.from(new Set(securityTransactions.map(tx => tx.symbol?.trim().toUpperCase()).filter(Boolean)));
    if (symbols.length > 0) {
      const insts = await fetchInstruments(symbols as string[]);
      setInstruments(insts);
    }
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    if (isOpen && productId) {
      setLoading(true);
      Promise.all([
        fetchProductHistory(productId),
        fetchProductTransactions(productId),
        fetchSecurityTransactions(productId).then(async (secTxns) => {
          const symbols = Array.from(new Set(secTxns.map(tx => tx.symbol?.trim().toUpperCase()).filter(Boolean)));
          const insts = symbols.length > 0 ? await fetchInstruments(symbols as string[]) : [];
          return { secTxns, insts };
        })
      ])
        .then(([, txns, { secTxns, insts }]) => {
          const data = generateHistoricalAUM(txns, secTxns, insts, productCashBalance);
          setChartData(data);
          setTransactions(txns);
          setSecurityTransactions(secTxns);
          setInstruments(insts);
        })
        .finally(() => setLoading(false));
    } else {
      setChartData([]);
      setTransactions([]);
      setSecurityTransactions([]);
      setInstruments([]);
      setActiveTab("chart");
    }
  }, [isOpen, productId]);

  // Aggregate all historical positions from security transactions
  const allPositions = useMemo(() => {
    interface Lot {
      units: number;
      faceValue: number;
      cost: number;
      dirtyPrice: number;
      valueDate: Date;
    }
    const holdings = new Map<string, { displayKey: string; lots: Lot[]; realizedGain: number; realizedCoupons: number }>();
    
    // Sort transactions chronologically for FIFO
    const sortedTxns = [...securityTransactions].sort((a,b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime());

    sortedTxns.forEach(tx => {
      const rawSymbol = tx.symbol || "Unknown";
      const key = rawSymbol.trim().toUpperCase();
      
      const current = holdings.get(key) || { displayKey: rawSymbol, lots: [], realizedGain: 0, realizedCoupons: 0 };
      const instrument = instruments.find(i => i.symbol.toUpperCase() === key);
      
      let accruedAtPurchase = 0;
      let dirtyPrice = Number(tx.price);
      const faceValue = instrument?.face_value || 100;
      
      if (instrument && instrument.coupon_rate && instrument.maturity_date) {
        accruedAtPurchase = calculateAccruedInterest(
          faceValue,
          instrument.coupon_rate,
          new Date(instrument.maturity_date),
          instrument.coupon_freq || 2,
          new Date(tx.value_date)
        );
        dirtyPrice += accruedAtPurchase;
      }
      
      const trancheFaceValue = Number(tx.units) * 100;
      const trancheUnits = trancheFaceValue / 100; // calculateTotalConsideration uses nominal units
      const trancheCost = calculateTotalConsideration(dirtyPrice, trancheUnits, faceValue);
      
      if (tx.direction === "BUY") {
        let remainingFaceToBuy = trancheFaceValue;
        
        // Offset any short lots first (from unmatched sells)
        while (remainingFaceToBuy > 0.01 && current.lots.length > 0 && current.lots[0].faceValue < -0.01) {
           const lot = current.lots[0];
           const shortFace = Math.abs(lot.faceValue);
           
           if (shortFace <= remainingFaceToBuy + 0.01) {
              const costOfCover = (trancheCost / trancheFaceValue) * shortFace;
              current.realizedGain += (lot.cost - costOfCover);
              
              remainingFaceToBuy -= shortFace;
              current.lots.shift();
           } else {
              const fractionCovered = remainingFaceToBuy / shortFace;
              const proceedsOfCovered = lot.cost * fractionCovered;
              const costOfCover = (trancheCost / trancheFaceValue) * remainingFaceToBuy;
              
              current.realizedGain += (proceedsOfCovered - costOfCover);
              
              lot.faceValue += remainingFaceToBuy;
              lot.units += remainingFaceToBuy / 100;
              lot.cost -= proceedsOfCovered;
              remainingFaceToBuy = 0;
           }
        }
        
        if (remainingFaceToBuy > 0.01) {
           current.lots.push({
             units: remainingFaceToBuy / 100,
             faceValue: remainingFaceToBuy,
             cost: (trancheCost / trancheFaceValue) * remainingFaceToBuy,
             dirtyPrice,
             valueDate: new Date(tx.value_date)
           });
        }
      } else if (tx.direction === "SELL") {
        let remainingFaceToSell = trancheFaceValue;
        
        while (remainingFaceToSell > 0.01 && current.lots.length > 0 && current.lots[0].faceValue > 0.01) {
          const lot = current.lots[0];
          
          if (lot.faceValue <= remainingFaceToSell + 0.01) { // Sell entire lot (with float tolerance)
             const soldFace = lot.faceValue;
             const soldUnits = lot.units;
             const costOfSold = lot.cost;
             
             const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
             current.realizedGain += (saleProceeds - costOfSold);
             
             if (instrument && instrument.coupon_rate && instrument.maturity_date && !isZeroCoupon(instrument.coupon_rate)) {
                current.realizedCoupons += calculateCouponsReceived(
                   soldFace,
                   instrument.coupon_rate,
                   new Date(instrument.maturity_date),
                   instrument.coupon_freq || 2,
                   lot.valueDate,
                   new Date(tx.value_date)
                );
             }
             
             remainingFaceToSell -= soldFace;
             current.lots.shift(); 
          } else { // Sell partial lot
             const fractionSold = remainingFaceToSell / lot.faceValue;
             const costOfSold = lot.cost * fractionSold;
             const soldUnits = remainingFaceToSell / 100; 
             
             const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
             current.realizedGain += (saleProceeds - costOfSold);
             
             if (instrument && instrument.coupon_rate && instrument.maturity_date && !isZeroCoupon(instrument.coupon_rate)) {
                current.realizedCoupons += calculateCouponsReceived(
                   remainingFaceToSell,
                   instrument.coupon_rate,
                   new Date(instrument.maturity_date),
                   instrument.coupon_freq || 2,
                   lot.valueDate,
                   new Date(tx.value_date)
                );
             }
             
             lot.faceValue -= remainingFaceToSell;
             lot.units -= soldUnits;
             lot.cost -= costOfSold;
             remainingFaceToSell = 0;
          }
        }
        
        // If there are still unmatched sells (missing history), push a short lot
        if (remainingFaceToSell > 0.01) {
           const soldUnits = remainingFaceToSell / 100;
           const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
           current.lots.push({
             units: -soldUnits,
             faceValue: -remainingFaceToSell,
             cost: saleProceeds, // Missing cost basis, so we store proceeds to calculate gain when covered
             dirtyPrice,
             valueDate: new Date(tx.value_date)
           });
        }
      }
      
      holdings.set(key, current);
    });
    
    return Array.from(holdings.values())
        .map((data) => {
          let openUnits = 0;
          let openCost = 0;
          let openCouponsReceived = 0;
          
          const instrument = instruments.find(i => i.symbol.toUpperCase() === data.displayKey.toUpperCase());
          const hasDetails = instrument && instrument.maturity_date;
          
          data.lots.forEach(lot => {
             openUnits += lot.faceValue; 
             openCost += lot.cost;
             if (hasDetails && !isZeroCoupon(instrument.coupon_rate) && lot.faceValue > 0) {
                openCouponsReceived += calculateCouponsReceived(
                  lot.faceValue,
                  instrument.coupon_rate,
                  new Date(instrument.maturity_date!),
                  instrument.coupon_freq || 2,
                  lot.valueDate,
                  new Date()
                );
             }
          });

          return { ...data, openUnits, openCost, openCouponsReceived, instrument, hasDetails };
        })
        .map((data) => {
          const { instrument, hasDetails, openUnits, openCost, openCouponsReceived, realizedGain, realizedCoupons } = data;
          
          let marketPrice = instrument?.market_price ?? 100;
          let marketValue = (openUnits * marketPrice) / 100;
          let accruedCoupon = 0;
          
          const isClosed = Math.abs(openUnits) < 0.01;
          let isMatured = false;
          let status = isClosed ? "Closed" : "Active";
          
          if (hasDetails) {
            const isTBill = isZeroCoupon(instrument!.coupon_rate);
            
            // Check maturity status
            const maturityDate = new Date(instrument!.maturity_date!);
            if (maturityDate < new Date()) {
                isMatured = true;
                status = "Matured";
            }
            
            if (!isClosed && !isMatured) { // Only calculate MTM if still active and not matured
                if (isTBill) {
                  if (instrument!.market_ytm != null) {
                    marketPrice = calculateTBillPrice(instrument!.market_ytm, new Date(), maturityDate);
                  }
                  marketValue = calculateTBillConsideration(marketPrice, openUnits);
                } else {
                  // Regular Bond Logic
                  if (instrument!.market_ytm != null) {
                    marketPrice = calculateCleanPrice(
                      instrument!.market_ytm,
                      instrument!.coupon_rate,
                      new Date(),
                      maturityDate,
                      instrument!.coupon_freq || 2,
                      instrument!.face_value || 100
                    );
                    const dirtyPrice = calculateDirtyPriceFromYTM(
                      instrument!.market_ytm,
                      instrument!.coupon_rate,
                      new Date(),
                      maturityDate,
                      instrument!.coupon_freq || 2,
                      instrument!.face_value || 100
                    );
                    marketValue = calculateTotalConsideration(dirtyPrice, openUnits / 100, instrument!.face_value || 100);
                  } else {
                    // Using Clean Price input
                    const accrued = calculateAccruedInterest(
                      instrument!.face_value || 100,
                      instrument!.coupon_rate,
                      maturityDate,
                      instrument!.coupon_freq || 2,
                      new Date()
                    );
                    const dirtyPrice = marketPrice + accrued;
                    marketValue = calculateTotalConsideration(dirtyPrice, openUnits / 100, instrument!.face_value || 100);
                  }
                  
                  accruedCoupon = calculateAccruedInterest(
                    instrument!.face_value || 100,
                    instrument!.coupon_rate,
                    maturityDate,
                    instrument!.coupon_freq || 2,
                    new Date()
                  ) * (openUnits / 100);
                }
            } else {
                marketValue = 0; // If closed or matured, market value is technically 0
                marketPrice = 0;
            }
          }
          
          let cleanMarketValue = marketValue;
          if (hasDetails && instrument && !isZeroCoupon(instrument.coupon_rate)) {
             cleanMarketValue = marketValue - accruedCoupon; 
          }
          
          const totalReturn = (cleanMarketValue - openCost) + accruedCoupon + openCouponsReceived;
          
          // Matured positions realize their remaining units at par value
          const maturityGain = isMatured && !isClosed ? (openUnits - openCost) : 0;
          const totalRealizedReturn = realizedGain + realizedCoupons + maturityGain + (isMatured && !isClosed ? openCouponsReceived : 0);

          return {
            name: data.displayKey,
            units: openUnits,
            value: openCost,
            marketPrice,
            marketValue,
            totalReturn: isClosed || isMatured ? 0 : totalReturn, // Zero out active return if closed/matured
            realizedReturn: totalRealizedReturn,
            realizedCoupons: realizedCoupons + (isMatured && !isClosed ? openCouponsReceived : 0),
            realizedCapitalGain: realizedGain + maturityGain,
            couponsReceived: openCouponsReceived,
            instrument,
            openLots: data.lots,
            status,
            isClosed,
            isMatured
          };
        })
        .sort((a, b) => {
            // Sort active first, then by name
            if (a.status === "Active" && b.status !== "Active") return -1;
            if (a.status !== "Active" && b.status === "Active") return 1;
            return a.name.localeCompare(b.name);
        });
  }, [securityTransactions, instruments]);

  // Aggregate current holdings from all positions
  const currentHoldings = useMemo(() => {
    return allPositions.filter(p => p.status === "Active");
  }, [allPositions]);



  const totalBookValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
  const totalMarketValue = currentHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalReturnPortfolio = currentHoldings.reduce((sum, h) => sum + h.totalReturn, 0);
  const totalRealizedReturn = allPositions.reduce((sum, h) => sum + (h.realizedReturn || 0), 0);
  const totalAUM = totalMarketValue + productCashBalance;

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
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold">Fund Composition (AUM)</h4>
                <Button size="sm" onClick={() => setIsBuyingNewInstrument(true)}>Add Instrument</Button>
              </div>
              {(currentHoldings.length > 0 || productCashBalance !== 0) ? (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2 px-3 font-medium">Instrument</th>
                      <th className="py-2 px-3 font-medium text-right">Market Price</th>
                      <th className="py-2 px-3 font-medium text-right">Book Value</th>
                      <th className="py-2 px-3 font-medium text-right">Market Value</th>
                      <th className="py-2 px-3 font-medium text-right">Active Return</th>
                      <th className="py-2 px-3 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentHoldings.map((h, i) => (
                      <tr 
                        key={h.name} 
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedBond(h)}
                      >
                        <td className="py-2 px-3 font-medium text-xs">{h.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {formatCurrency(h.marketPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {formatCurrency(h.value)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-primary font-medium">
                          {formatCurrency(h.marketValue)}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono text-xs font-medium ${
                          h.totalReturn > 0 ? "text-emerald-600" : h.totalReturn < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {h.value > 0 ? (h.totalReturn / h.value * 100).toFixed(2) + "%" : "0.00%"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingInstrument(h);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/10 font-semibold text-xs border-t-2 border-border">
                    <tr>
                      <td className="py-2 px-3 text-muted-foreground">Total Bonds</td>
                      <td className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(totalBookValue)}</td>
                      <td className="py-2 px-3 text-right font-mono text-primary">{formatCurrency(totalMarketValue)}</td>
                      <td className={`py-2 px-3 text-right font-mono ${
                          totalReturnPortfolio > 0 ? "text-emerald-600" : totalReturnPortfolio < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {totalBookValue > 0 ? (totalReturnPortfolio / totalBookValue * 100).toFixed(2) + "%" : "0.00%"}
                      </td>
                      <td></td>
                    </tr>

                    <tr className="border-t border-border bg-emerald-50/50">
                      <td className="py-2 px-3 text-muted-foreground">Realized Returns (Closed)</td>
                      <td colSpan={2}></td>
                      <td colSpan={2} className={`py-2 px-3 text-right font-mono font-medium ${
                          totalRealizedReturn > 0 ? "text-emerald-600" : totalRealizedReturn < 0 ? "text-red-600" : "text-muted-foreground"
                      }`}>
                          {totalRealizedReturn > 0 ? "+" : ""}{formatCurrency(totalRealizedReturn)}
                      </td>
                      <td></td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-3 px-3 text-sm text-foreground">Total AUM</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-muted-foreground">{formatCurrency(totalBookValue + productCashBalance)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-primary">{formatCurrency(totalAUM)}</td>
                      <td className={`py-3 px-3 text-right font-mono text-sm ${
                          totalAUM > (totalBookValue + productCashBalance) ? "text-emerald-600" : totalAUM < (totalBookValue + productCashBalance) ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {totalBookValue + productCashBalance > 0 ? ((totalAUM - (totalBookValue + productCashBalance)) / (totalBookValue + productCashBalance) * 100).toFixed(2) + "%" : "0.00%"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                  No holdings in this fund yet. Click "Add Instrument" to add one.
                </div>
              )}
            </div>
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
            {allPositions.length === 0 ? (
              <div className="w-full h-[200px] flex items-center justify-center">
                <p className="text-muted-foreground">No positions recorded.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 px-3 font-medium">Instrument</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-right">Active Return</th>
                    <th className="py-2 px-3 font-medium text-right">Realized Return</th>
                    <th className="py-2 px-3 font-medium text-right">Total Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {allPositions.map((pos, i) => {
                    const totalCashFlow = pos.couponsReceived + (pos.isClosed || pos.isMatured ? pos.marketValue + pos.value : 0); 
                    // Cash flow is just a helper for display, realized return is more accurate
                    return (
                      <tr
                        key={pos.name}
                        className={`border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors ${
                          i % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                        onClick={() => setSelectedBond(pos)}
                      >
                        <td className="py-2 px-3 text-xs font-medium whitespace-nowrap">
                          {pos.name}
                          {pos.isMatured && (
                            <span className="ml-2 inline-flex items-center text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700" title="Held to Maturity">
                              Matured
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm ${
                              pos.status === "Active"
                                ? "bg-emerald-100 text-emerald-700"
                                : pos.status === "Matured"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {pos.status}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-xs text-right font-mono font-medium ${
                          pos.totalReturn > 0 ? "text-emerald-600" : pos.totalReturn < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {pos.status === "Active" ? (pos.totalReturn > 0 ? "+" : "") + formatCurrency(pos.totalReturn) : "—"}
                        </td>
                        <td className={`py-2 px-3 text-xs text-right font-mono font-medium ${
                          pos.realizedReturn > 0 ? "text-emerald-600" : pos.realizedReturn < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {pos.realizedReturn !== 0 ? (pos.realizedReturn > 0 ? "+" : "") + formatCurrency(pos.realizedReturn) : "—"}
                        </td>
                        <td className="py-2 px-3 text-xs text-right font-mono text-muted-foreground">
                          {formatCurrency(pos.couponsReceived + pos.realizedReturn)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </DialogContent>
      {editingInstrument && (
        <EditInstrumentDialog
          instrument={editingInstrument.instrument || { symbol: editingInstrument.name }}
          onClose={() => setEditingInstrument(null)}
          onSave={async (data) => {
            await upsertInstrument(data);
            await refreshInstruments();
            setEditingInstrument(null);
          }}
        />
      )}
      {selectedBond && (
        <BondDetailsSheet 
          bond={selectedBond}
          securityTransactions={securityTransactions}
          productCurrency={productCurrency}
          onClose={() => setSelectedBond(null)}
          productId={productId}
          onRefresh={refreshTransactionsAndInstruments}
          onEdit={() => {
             // Close the sheet when opening edit to avoid stacking (optional, but let's just leave sheet open behind it or not?)
             // Actually, the edit dialog sits on top.
             setEditingInstrument(selectedBond);
          }}
        />
      )}
      {isBuyingNewInstrument && (
        <BuyNewInstrumentDialog
          productId={productId}
          onClose={() => setIsBuyingNewInstrument(false)}
          onSave={async () => {
            setIsBuyingNewInstrument(false);
            await refreshTransactionsAndInstruments();
          }}
        />
      )}
    </Dialog>
  );
}

function BuyNewInstrumentDialog({
  productId,
  onClose,
  onSave
}: {
  productId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState("");
  
  // Bond Specific
  const [couponRate, setCouponRate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [ytmInput, setYtmInput] = useState("");

  const faceValueInput = Number(units) || 0;
  const unitsNum = faceValueInput / 100; // Translate 500,000,000 face value to 5,000,000 units
  const ytmNum = Number(ytmInput) || 0;
  const couponNum = Number(couponRate) || 0;
  
  let cleanPrice = 0;
  let dirtyPrice = 0;
  let totalConsideration = 0;
  let accrued = 0;
  
  if (ytmInput && maturityDate) {
    const isTBill = isZeroCoupon(couponNum);
    
    if (isTBill) {
      cleanPrice = calculateTBillPrice(ytmNum, new Date(settlementDate), new Date(maturityDate));
      accrued = 0;
      dirtyPrice = cleanPrice;
      totalConsideration = calculateTBillConsideration(cleanPrice, faceValueInput);
    } else {
      cleanPrice = calculateCleanPrice(
        ytmNum, 
        couponNum, 
        new Date(settlementDate), 
        new Date(maturityDate), 
        2, 
        100
      );
      accrued = calculateAccruedInterest(
        100,
        couponNum,
        new Date(maturityDate),
        2,
        new Date(settlementDate)
      );
      dirtyPrice = cleanPrice + accrued;
      totalConsideration = calculateTotalConsideration(dirtyPrice, unitsNum, 100);
    }
  }

  const handleSave = async () => {
    if (!symbol || !units || !cleanPrice) return;
    setLoading(true);
    
    // 1. Create/Update the instrument with the new details
    await upsertInstrument({
      symbol: symbol.trim().toUpperCase(),
      coupon_rate: couponNum,
      maturity_date: maturityDate,
      face_value: 100,
      coupon_freq: 2,
      asset_class: "bond",
      currency: "NGN",
    });

    // 2. Add the transaction
    await createSecurityTransaction({
      product_id: productId,
      direction: "BUY",
      symbol: symbol.trim().toUpperCase(),
      units: unitsNum, // True units (faceValue / 100)
      price: cleanPrice,
      ytm: ytmNum,
      value_date: settlementDate,
    });
    
    setLoading(false);
    onSave();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Buy New Instrument</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Instrument Symbol</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. FGN 2038 BOND"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Settlement Date</Label>
              <Input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Total Face Value (₦)</Label>
              <Input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g. 500000000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Coupon Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={couponRate}
                onChange={(e) => setCouponRate(e.target.value)}
                placeholder="e.g. 15.5"
              />
            </div>
            <div className="grid gap-2">
              <Label>Maturity Date</Label>
              <Input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Purchase YTM (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={ytmInput}
              onChange={(e) => setYtmInput(e.target.value)}
              placeholder="e.g. 14.5"
            />
          </div>
          
          {ytmInput && maturityDate && (
            <div className="bg-slate-50 border p-3 rounded text-sm grid gap-2 mt-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Clean Price:</span>
                <span className="font-mono">{cleanPrice.toFixed(4)}</span>
              </div>
              {!isZeroCoupon(couponNum) && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Accrued Interest:</span>
                  <span className="font-mono">{accrued.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">{isZeroCoupon(couponNum) ? 'Price' : 'Dirty Price'}:</span>
                <span className="font-mono font-medium">{dirtyPrice.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-1">
                <span className="text-slate-800 font-medium">Total Consideration:</span>
                <span className="font-mono font-bold text-primary">
                  ₦{totalConsideration.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={loading || !symbol || !units || !cleanPrice} onClick={handleSave}>
            {loading ? "Saving..." : "Add to Fund"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BondDetailsSheet({ 
  bond, 
  securityTransactions,
  productCurrency,
  onClose,
  productId,
  onRefresh,
  onEdit
}: { 
  bond: any; 
  securityTransactions: any[];
  productCurrency: string;
  onClose: () => void;
  productId: string;
  onRefresh: () => void;
  onEdit?: () => void;
}) {
  const [isAddingTranche, setIsAddingTranche] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const symbol = productCurrency === "NGN" ? "₦" : "$";
  const formatCurrency = (val: number) => `${symbol}${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  
  const lots = useMemo(() => {
    if (!bond.openLots) return [];
    
    return bond.openLots.map((lot: any, index: number) => {
      const hasDetails = bond.instrument?.maturity_date;
      const isTBill = hasDetails && isZeroCoupon(bond.instrument?.coupon_rate);
      
      let htmYield = 0;
      let couponsReceived = 0;
      
      if (hasDetails) {
        if (isTBill) {
          htmYield = calculateTBillYield(lot.dirtyPrice, lot.valueDate, new Date(bond.instrument.maturity_date));
        } else {
           htmYield = calculateYTM(
             lot.dirtyPrice, // using dirtyPrice isn't exact for clean, but it's close enough for approximate display
             bond.instrument.coupon_rate,
             new Date(bond.instrument.maturity_date),
             bond.instrument.face_value || 100,
             lot.valueDate
           );
           
           couponsReceived = calculateCouponsReceived(
             lot.faceValue,
             bond.instrument.coupon_rate,
             new Date(bond.instrument.maturity_date),
             bond.instrument.coupon_freq || 2,
             lot.valueDate,
             new Date()
           );
        }
      }

      return {
        id: index.toString(), // lots don't have tx IDs anymore since they can be partials
        date: lot.valueDate,
        units: lot.faceValue,
        price: lot.dirtyPrice, // This was original price
        dirtyPrice: lot.dirtyPrice, 
        accrued: 0, // Since it's baked into dirtyPrice we simplify
        cost: lot.cost,
        htmYield,
        couponsReceived
      };
    }).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
  }, [bond]);

  const instrument = bond.instrument;
  const hasDetails = instrument && instrument.maturity_date;
  const isTBill = hasDetails && isZeroCoupon(instrument.coupon_rate);
  
  let accruedCoupon = 0;
  let ytm = 0;
  let totalReturn = bond.totalReturn; // USE COMPUTED VALUE!
  let totalCouponsReceived = bond.couponsReceived; // USE COMPUTED VALUE!
  
  if (hasDetails) {
    const faceValue = instrument.face_value || 100;
    const maturityDate = new Date(instrument.maturity_date);
    
    if (isTBill) {
      if (instrument.market_ytm != null) {
        ytm = instrument.market_ytm;
      } else {
        ytm = calculateTBillYield(bond.marketPrice, new Date(), maturityDate);
      }
    } else {
      const freq = instrument.coupon_freq || 2;
      
      accruedCoupon = calculateAccruedInterest(
        faceValue,
        instrument.coupon_rate,
        maturityDate,
        freq,
        new Date()
      ) * (bond.units / 100);
      
      if (instrument.market_ytm != null) {
        ytm = instrument.market_ytm;
      } else {
        ytm = calculateYTM(bond.marketPrice, instrument.coupon_rate, maturityDate, faceValue);
      }
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[800px] overflow-y-auto w-full">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl text-primary">{bond.name}</SheetTitle>
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onEdit}
                title="Edit Instrument Details"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
            {!isTBill && (
              <div>
                <span className="block text-xs font-semibold uppercase">Coupon</span>
                <span className="font-mono text-foreground">{instrument?.coupon_rate ? `${instrument.coupon_rate}%` : 'N/A'}</span>
              </div>
            )}
            <div>
              <span className="block text-xs font-semibold uppercase">Maturity</span>
              <span className="font-mono text-foreground">
                {instrument?.maturity_date ? new Date(instrument.maturity_date).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </SheetHeader>
        
        <div className="space-y-6">
          {/* Valuation Summary */}
          <div className="bg-slate-50 border rounded-lg p-4 grid gap-3">
            <h3 className="text-sm font-semibold text-slate-800 uppercase border-b pb-2">Valuation Summary</h3>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 cursor-help border-b border-dotted border-slate-400" title="Total face value of all active purchase lots for this bond. This is the nominal amount the issuer will repay at maturity.">Total Face Value</span>
              <span className="font-mono">{bond.units.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 cursor-help border-b border-dotted border-slate-400" title="Sum of Total Considerations across all purchase tranches. This is the actual amount of cash paid to acquire the bond, including accrued interest paid to the seller at settlement.">Book Value (Cost)</span>
              <span className="font-mono">{formatCurrency(bond.value)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 cursor-help border-b border-dotted border-slate-400" title="Current mark-to-market value using the clean price (excluding accrued interest). Clean Price × Face Value ÷ 100.">Market Value (Clean)</span>
              <span className="font-mono font-medium">{formatCurrency(bond.marketValue - accruedCoupon)}</span>
            </div>
            
            {bond.realizedReturn !== 0 && (
              <>
                <div className="flex justify-between items-center text-sm font-medium border-t pt-2 mt-1">
                  <span className="text-slate-800 cursor-help border-b border-dotted border-slate-700" title="Net gain or loss realized from closed (sold or matured) positions of this specific instrument.">Realized Returns (Closed)</span>
                  <span className={`font-mono ${bond.realizedReturn >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {bond.realizedReturn >= 0 ? "+" : ""}{formatCurrency(bond.realizedReturn)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1 pl-4">
                  <span className="text-slate-500">└ Capital Gain/Loss:</span>
                  <span className={`font-mono ${bond.realizedCapitalGain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {bond.realizedCapitalGain >= 0 ? "+" : ""}{formatCurrency(bond.realizedCapitalGain)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1 pl-4">
                  <span className="text-slate-500">└ Cash Coupons:</span>
                  <span className={`font-mono ${bond.realizedCoupons > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                    +{formatCurrency(bond.realizedCoupons)}
                  </span>
                </div>
              </>
            )}
            
            {hasDetails ? (
              <>
                {!isTBill && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 cursor-help border-b border-dotted border-slate-400" title="Interest that has built up since the last coupon payment date but has not yet been paid out. Calculated as: (Coupon Rate ÷ Frequency) × (Days Since Last Coupon ÷ Days in Period) × Face Value.">Accrued Coupon</span>
                      <span className="font-mono text-emerald-600">+{formatCurrency(accruedCoupon)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 cursor-help border-b border-dotted border-slate-400" title="Total cash coupon payments actually received since the purchase settlement date. Each coupon = Face Value × (Coupon Rate ÷ Frequency). Only counted for coupon dates that have passed since you bought the bond.">Coupons Received (Cash)</span>
                      <span className="font-mono text-emerald-600">+{formatCurrency(totalCouponsReceived)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center text-sm font-medium border-t pt-2">
                  <span className="text-slate-800 cursor-help border-b border-dotted border-slate-700" title={isTBill ? "Total Return = Market Value - Book Value. For Treasury Bills, this is purely the capital appreciation as they are zero-coupon instruments issued at a discount." : "Total Return = (Clean Market Value − Book Value) + Accrued Coupon + Coupons Received. This captures: (1) unrealized capital gain/loss on the clean price, (2) interest earned but not yet paid, and (3) actual cash coupons received since purchase."}>Active Return (MTM)</span>
                  <div className="text-right">
                    <span className={`block font-mono ${totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {totalReturn >= 0 ? "+" : ""}{formatCurrency(totalReturn)}
                    </span>
                    <span className={`block text-xs font-mono ${totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {totalReturn >= 0 ? "+" : ""}{((totalReturn / bond.value) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm font-medium mt-1">
                  <span className="text-slate-800 cursor-help border-b border-dotted border-slate-700" title={isTBill ? "Discount Rate / Yield — The annualized true yield of the Treasury Bill calculated using Actual/365 convention." : "Yield to Maturity — the annualized return if you hold this bond until maturity, assuming all coupons are reinvested at the same rate. Derived from the current market YTM or approximated from the clean price."}>{isTBill ? 'Discount Rate / Yield' : 'HTM Yield (YTM)'}</span>
                  <span className="font-mono text-indigo-600">{ytm.toFixed(2)}%</span>
                </div>
              </>
            ) : !bond.isClosed ? (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2 border border-amber-200">
                Please edit the instrument to add maturity date to see yield metrics.
              </div>
            ) : null}
            {hasDetails && !isTBill && (() => {
              const nextCoupon = getNextCouponDate(
                new Date(instrument.maturity_date),
                instrument.coupon_freq || 2,
                new Date()
              );
              const prevCoupon = getPreviousCouponDate(
                new Date(instrument.maturity_date),
                instrument.coupon_freq || 2,
                new Date()
              );
              
              return (
                <div className="bg-slate-50 border rounded-lg p-4 grid gap-3 mt-4">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase border-b pb-2">Bond Metrics</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Previous Coupon Date</span>
                    <span className="font-mono">{prevCoupon.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Next Coupon Date</span>
                    <span className="font-mono">{nextCoupon.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-2 mt-1">
                    <span className="text-slate-600">Current Clean Price</span>
                    <span className="font-mono">{bond.marketPrice.toFixed(4)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
          
          {/* Transaction Lots (Active) */}
          {bond.status === "Active" && (
            <div className="mb-6">
              <div className="flex justify-between items-center border-b pb-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-800 uppercase">Purchase History (Active Lots)</h3>
                <Button size="sm" onClick={() => setIsAddingTranche(true)}>New Tranche</Button>
              </div>
              {lots.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="py-2 px-3 font-medium text-slate-600">Settlement Date</th>
                        <th className="py-2 px-3 font-medium text-slate-600 text-right">Units</th>
                        <th className="py-2 px-3 font-medium text-slate-600 text-right" title="Clean Price">Clean Price</th>
                        <th className="py-2 px-3 font-medium text-slate-600 text-right" title="Dirty Price">Dirty Price</th>
                        <th className="py-2 px-3 font-medium text-slate-600 text-right" title="Total Consideration">Total Consideration</th>
                        {hasDetails && <th className="py-2 px-3 font-medium text-slate-600 text-right">HTM Yield</th>}
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lots.map(lot => (
                        <tr key={lot.id}>
                          <td className="py-2 px-3">{lot.date.toLocaleDateString()}</td>
                          <td className="py-2 px-3 font-mono text-right">{lot.units.toLocaleString()}</td>
                          <td className="py-2 px-3 font-mono text-right">{lot.price.toFixed(4)}</td>
                          <td className="py-2 px-3 font-mono text-right">{lot.dirtyPrice.toFixed(4)}</td>
                          <td className="py-2 px-3 font-mono text-right">{formatCurrency(lot.cost)}</td>
                          {hasDetails && <td className="py-2 px-3 font-mono text-right">{lot.htmYield.toFixed(2)}%</td>}
                          <td className="py-2 px-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              disabled={isDeleting === lot.id}
                              onClick={async () => {
                                setIsDeleting(lot.id);
                                await deleteSecurityTransaction(lot.id);
                                onRefresh();
                                setIsDeleting(null);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No active purchase lots found.</p>
              )}
            </div>
          )}

          {/* Full Transaction Ledger */}
          <div>
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-800 uppercase">Full Transaction Ledger</h3>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="py-2 px-3 font-medium text-slate-600">Value Date</th>
                    <th className="py-2 px-3 font-medium text-slate-600">Type</th>
                    <th className="py-2 px-3 font-medium text-slate-600 text-right">Units</th>
                    <th className="py-2 px-3 font-medium text-slate-600 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {securityTransactions
                    .filter(tx => (tx.symbol || "").trim().toUpperCase() === (bond.name || "").trim().toUpperCase())
                    .sort((a,b) => new Date(a.value_date).getTime() - new Date(b.value_date).getTime())
                    .map((tx, i) => (
                      <tr key={tx.id || i}>
                        <td className="py-2 px-3">{new Date(tx.value_date).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm ${
                              tx.direction === "BUY"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {tx.direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-right">{(Number(tx.units) * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-2 px-3 font-mono text-right">{Number(tx.price).toFixed(4)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SheetContent>
      {isAddingTranche && (
        <AddTrancheDialog
          instrument={instrument}
          productId={productId}
          onClose={() => setIsAddingTranche(false)}
          onSave={() => {
            setIsAddingTranche(false);
            onRefresh();
          }}
        />
      )}
    </Sheet>
  );
}

function AddTrancheDialog({
  instrument,
  productId,
  onClose,
  onSave
}: {
  instrument: any;
  productId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState("");
  const [ytmInput, setYtmInput] = useState("");
  
  const faceValueInput = Number(units) || 0;
  const unitsNum = faceValueInput / 100; // Translate face value to units
  const ytmNum = Number(ytmInput) || 0;
  const hasDetails = instrument?.maturity_date;
  const isTBill = hasDetails && isZeroCoupon(instrument.coupon_rate);
  
  let cleanPrice = 0;
  let dirtyPrice = 0;
  let totalConsideration = 0;
  let accrued = 0;
  
  if (hasDetails && ytmInput) {
    if (isTBill) {
      cleanPrice = calculateTBillPrice(ytmNum, new Date(settlementDate), new Date(instrument.maturity_date));
      accrued = 0;
      dirtyPrice = cleanPrice;
      totalConsideration = calculateTBillConsideration(cleanPrice, faceValueInput);
    } else {
      cleanPrice = calculateCleanPrice(
        ytmNum, 
        instrument.coupon_rate, 
        new Date(settlementDate), 
        new Date(instrument.maturity_date), 
        instrument.coupon_freq || 2, 
        instrument.face_value || 100
      );
      accrued = calculateAccruedInterest(
        instrument.face_value || 100,
        instrument.coupon_rate,
        new Date(instrument.maturity_date),
        instrument.coupon_freq || 2,
        new Date(settlementDate)
      );
      dirtyPrice = cleanPrice + accrued;
      totalConsideration = calculateTotalConsideration(dirtyPrice, unitsNum, instrument.face_value || 100);
    }
  }

  const handleSave = async () => {
    if (!hasDetails || !cleanPrice) return;
    setLoading(true);
    await createSecurityTransaction({
      product_id: productId,
      direction: "BUY",
      symbol: instrument.symbol,
      units: unitsNum / 100, // Normalize to database units
      price: cleanPrice,
      ytm: ytmNum,
      value_date: settlementDate,
    });
    setLoading(false);
    onSave();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Tranche: {instrument?.symbol}</DialogTitle>
        </DialogHeader>
        {!hasDetails ? (
          <div className="text-sm text-destructive py-4">
            Instrument details (coupon rate, maturity date) are missing. Please edit the instrument first.
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Settlement Date</Label>
                <Input
                  type="date"
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Units</Label>
                <Input
                  type="number"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  placeholder="e.g. 1000000"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Purchase YTM (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={ytmInput}
                onChange={(e) => setYtmInput(e.target.value)}
                placeholder="e.g. 15.25"
              />
            </div>
            
            {ytmInput && (
              <div className="bg-slate-50 border p-3 rounded text-sm grid gap-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Clean Price:</span>
                  <span className="font-mono">{cleanPrice.toFixed(4)}</span>
                </div>
                {!isTBill && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Accrued Interest:</span>
                    <span className="font-mono">{accrued.toFixed(4)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">{isTBill ? 'Price' : 'Dirty Price'}:</span>
                  <span className="font-mono font-medium">{dirtyPrice.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-1">
                  <span className="text-slate-800 font-medium">Total Consideration:</span>
                  <span className="font-mono font-bold text-primary">
                    ₦{totalConsideration.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={loading || !hasDetails || !ytmInput} onClick={handleSave}>
            {loading ? "Saving..." : "Save Tranche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditInstrumentDialog({
  instrument,
  onClose,
  onSave,
}: {
  instrument: any;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [marketYtm, setMarketYtm] = useState(instrument.market_ytm ? String(instrument.market_ytm) : "");
  const [marketPrice, setMarketPrice] = useState(String(instrument.market_price ?? ""));
  const [couponRate, setCouponRate] = useState(instrument.coupon_rate != null ? String(instrument.coupon_rate) : "");
  const [couponFreq, setCouponFreq] = useState(String(instrument.coupon_freq ?? 2));
  const [maturityDate, setMaturityDate] = useState(
    instrument.maturity_date ? new Date(instrument.maturity_date).toISOString().slice(0, 10) : ""
  );
  const [issueDate, setIssueDate] = useState(
    instrument.issue_date ? new Date(instrument.issue_date).toISOString().slice(0, 10) : ""
  );
  const [currency, setCurrency] = useState(instrument.currency ?? "NGN");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Instrument: {instrument.symbol}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Row 1: Market YTM & Market Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ytm" className="flex items-center gap-1">
                Market YTM (%)
                <span className="text-xs text-muted-foreground ml-1" title="The current market yield-to-maturity used for mark-to-market valuation. This drives the clean price calculation.">ⓘ</span>
              </Label>
              <Input
                id="ytm"
                type="number"
                step="0.01"
                placeholder="e.g. 18.5"
                value={marketYtm}
                onChange={(e) => setMarketYtm(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price" className="flex items-center gap-1">
                Market Price
                <span className="text-xs text-muted-foreground ml-1" title="Current clean price per 100 nominal. If Market YTM is provided, clean price will be derived from it automatically.">ⓘ</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.0001"
                placeholder="e.g. 123.10"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
              />
            </div>
          </div>
          
          {/* Row 2: Coupon Rate & Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="coupon_rate">Coupon Rate (%)</Label>
              <Input
                id="coupon_rate"
                type="number"
                step="0.01"
                placeholder="e.g. 22.6"
                value={couponRate}
                onChange={(e) => setCouponRate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coupon_freq">Coupon Frequency</Label>
              <select
                id="coupon_freq"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={couponFreq}
                onChange={(e) => setCouponFreq(e.target.value)}
              >
                <option value="1">Annual (1×/yr)</option>
                <option value="2">Semi-Annual (2×/yr)</option>
                <option value="4">Quarterly (4×/yr)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Issue Date & Maturity Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maturity">Maturity Date</Label>
              <Input
                id="maturity"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Currency */}
          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="NGN">NGN (₦)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onSave({
                symbol: instrument.symbol,
                market_price: marketPrice ? Number(marketPrice) : 100,
                market_ytm: marketYtm ? Number(marketYtm) : null,
                face_value: 100,
                coupon_rate: couponRate ? Number(couponRate) : null,
                coupon_freq: couponFreq ? Number(couponFreq) : null,
                maturity_date: maturityDate ? maturityDate : null,
                issue_date: issueDate ? issueDate : null,
                currency: currency,
              });
              setLoading(false);
            }}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
