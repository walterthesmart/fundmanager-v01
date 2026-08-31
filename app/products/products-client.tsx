'use client'

import { useMemo, useState, useTransition } from "react";
import {
  Download,
  FileSpreadsheet,
  Gauge,
  Loader2,
  Pencil,
  RefreshCw,
  Upload,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { ASSET_CLASSES } from "@/lib/wealth-data";
import { downloadCsv, parseCsv, priceTemplateCsv, toCsv } from "@/lib/csv";
import { useDisplayCurrency } from "@/lib/display-currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyPricesAction, refreshLivePricesAction } from "../actions";
import { ProductChartModal } from "@/components/product-chart-modal";

const PRICE_SOURCES = [
  "NGX Market Feed",
  "Bloomberg",
  "Refinitiv",
  "CBN OMO Rates",
  "ICE Data Services",
  "yahoo-finance",
];

export function ProductsClient({ initialProducts, userId }: { initialProducts: any[], userId?: string }) {
  const [products, setProducts] = useState(initialProducts);
  const { format: formatMoney } = useDisplayCurrency();
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedChartProduct, setSelectedChartProduct] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleApplyPrices = async (updates: any[]) => {
    startTransition(async () => {
      try {
        const count = await applyPricesAction(updates.map(u => ({
          id: u.product.id,
          price: u.price,
          mode: u.mode,
          source: u.source
        })), userId);
        toast.success(`${count} price${count === 1 ? "" : "s"} updated`);
        setEditing(null);
      } catch (error: any) {
        toast.error(error.message);
      }
    });
  };

  const handleRefreshLivePrices = () => {
    startTransition(async () => {
      try {
        const res = await refreshLivePricesAction();
        if (res && res.updated && res.updated > 0) {
          toast.success(`Refreshed ${res.updated} product prices from live sources`);
        } else {
          toast.info("No prices were updated");
        }
      } catch (error: any) {
        toast.error(error.message);
      }
    });
  };

  const onPriceFile = async (file: File) => {
    const parsed = parseCsv(await file.text());
    const updates = parsed.flatMap((row) => {
      const product = products.find(
        (p) => p.ticker.toLowerCase() === (row["ticker"] ?? "").trim().toLowerCase(),
      );
      const price = Number(row["price"]);
      if (!product || !Number.isFinite(price) || price <= 0) return [];
      const mode = row["price_mode"] === "automated" ? "automated" : "manual";
      return [{ product, price, mode: mode as "manual" | "automated", source: row["price_source"] || null }];
    });
    if (updates.length === 0) {
      toast.error("No matching tickers found in that file");
      return;
    }
    handleApplyPrices(updates);
  };

  const report = () => {
    downloadCsv(
      `sankore-prices-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        ["Ticker", "Product", "Asset class", "Currency", "Price", "Previous", "Mode", "Source", "Updated"],
        ...products.map((p) => [
          p.ticker,
          p.name,
          p.asset_class,
          p.currency,
          Number(p.price).toFixed(4),
          p.previous_price === null ? "" : Number(p.previous_price).toFixed(4),
          p.price_mode,
          p.price_source ?? "",
          p.price_updated_at,
        ]),
      ]),
    );
  };

  return (
    <DashboardShell
      title="Products"
      subtitle="Asset classes, individual pricing and price provenance"
      actions={
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="rounded-none" 
            onClick={handleRefreshLivePrices}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-4" />
            )}
            <span className="hidden sm:inline">Refresh Live Prices</span>
          </Button>
          <Button size="sm" variant="outline" className="rounded-none" onClick={report}>
            <FileSpreadsheet className="mr-1.5 size-4" />
            <span className="hidden sm:inline">Generate report</span>
          </Button>
        </div>
      }
    >
      <section className="panel mb-4 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Bulk price upload</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Columns: ticker, price, price_mode (manual/automated), price_source.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-none"
            onClick={() => downloadCsv("sankore-price-template.csv", priceTemplateCsv())}
          >
            <Download className="mr-1.5 size-4" /> Price template
          </Button>
        </div>
        <div>
          <Label htmlFor="price-file" className="text-sm font-semibold">
            Upload price file
          </Label>
          <Input
            id="price-file"
            className="mt-3"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPriceFile(file);
            }}
          />
          {isPending && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Applying prices…
            </p>
          )}
        </div>
      </section>

      <Tabs defaultValue={ASSET_CLASSES[0].value}>
        <TabsList className="mb-4 flex-wrap">
          {ASSET_CLASSES.map((ac) => (
            <TabsTrigger key={ac.value} value={ac.value}>
              {ac.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ASSET_CLASSES.map((ac) => {
          const list = products.filter((p) => p.asset_class === ac.value);
          return (
            <TabsContent key={ac.value} value={ac.value}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((product) => {
                  const change =
                    product.previous_price && Number(product.previous_price) > 0
                      ? ((Number(product.price) - Number(product.previous_price)) /
                          Number(product.previous_price)) *
                        100
                      : 0;
                  const stale =
                    product.price_mode === "manual" &&
                    Date.now() - new Date(product.price_updated_at).getTime() >
                      1000 * 60 * 60 * 24 * 7;
                  return (
                    <div 
                      key={product.id} 
                      className="panel p-4 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setSelectedChartProduct(product)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium flex items-center gap-2">
                            {product.name}
                            {product.ticker === "SGF-IAU" && (
                              <span className="inline-flex items-center text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-destructive text-destructive-foreground">
                                Closed
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{product.ticker}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0 rounded-none z-10"
                          aria-label={`Edit price for ${product.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(product);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>

                      <p className="text-numeric mt-3 text-xl font-semibold">
                        {formatMoney(product.aum, product.currency)}
                      </p>
                      <p
                        className={`text-xs ${change >= 0 ? "text-mint-foreground" : "text-destructive"}`}
                      >
                        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% vs previous
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {product.price_mode === "automated" ? (
                          <Badge className="rounded-none text-[10px] uppercase">
                            <RefreshCw className="mr-1 size-3" /> automated
                          </Badge>
                        ) : (
                          <Badge
                            variant={stale ? "destructive" : "outline"}
                            className="rounded-none text-[10px] uppercase"
                          >
                            <Gauge className="mr-1 size-3" /> manual
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {product.price_mode === "automated"
                            ? `source: ${product.price_source ?? "unspecified"}`
                            : `last set ${formatDistanceToNow(new Date(product.price_updated_at), { addSuffix: true })}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products in this asset class.</p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <EditPriceDialog
        product={editing}
        pending={isPending}
        onClose={() => setEditing(null)}
        onSave={(price, mode, source) =>
          editing && handleApplyPrices([{ product: editing, price, mode, source }])
        }
      />

      <ProductChartModal 
        productId={selectedChartProduct?.id} 
        productName={selectedChartProduct?.name}
        productCurrency={selectedChartProduct?.currency}
        isOpen={Boolean(selectedChartProduct)}
        onClose={() => setSelectedChartProduct(null)}
      />
    </DashboardShell>
  );
}

function EditPriceDialog({
  product,
  pending,
  onClose,
  onSave,
}: {
  product: any | null;
  pending: boolean;
  onClose: () => void;
  onSave: (price: number, mode: "manual" | "automated", source: string | null) => void;
}) {
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"manual" | "automated">("manual");
  const [source, setSource] = useState<string>(PRICE_SOURCES[0] ?? "");

  const key = product?.id ?? "none";
  useMemo(() => {
    if (product) {
      setPrice(String(product.price));
      setMode(product.price_mode);
      setSource(product.price_source ?? PRICE_SOURCES[0] ?? "");
    }
  }, [key]);

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>
            Set the price manually or hand pricing over to an automated source. Every change is
            written to price history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Price ({product?.currency})</Label>
            <Input
              type="number"
              min="0.0001"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Pricing mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "manual" | "automated")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "automated" && (
            <div className="space-y-2">
              <Label>Price source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              const value = Number(price);
              if (!Number.isFinite(value) || value <= 0) {
                toast.error("Enter a price above zero");
                return;
              }
              onSave(value, mode, mode === "automated" ? source : null);
            }}
          >
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Save price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
