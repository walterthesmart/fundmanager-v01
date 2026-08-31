import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, useDisplayCurrency } from "@/lib/display-currency";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useDisplayCurrency();

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger
        aria-label="Display currency"
        className="press h-9 w-[86px] rounded-none border-sidebar-border bg-transparent text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {CURRENCIES.map((code) => (
          <SelectItem key={code} value={code} className="text-xs">
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
