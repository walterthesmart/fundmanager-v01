'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** Static indicative rates relative to USD (presentation-only conversion). */
export const CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  NGN: 1520,
  ZAR: 18.1,
  KES: 129,
  GHS: 15.4,
  CAD: 1.36,
};

export const CURRENCIES = Object.keys(CURRENCY_RATES);

const STORAGE_KEY = "sankore-display-currency";

type Ctx = {
  currency: string;
  setCurrency: (c: string) => void;
  /** Convert a value stored in `from` currency and format it in the display currency. */
  format: (value: number | string | null, from?: string) => string;
};

const DisplayCurrencyContext = createContext<Ctx | undefined>(undefined);

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("USD");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && CURRENCY_RATES[stored]) setCurrencyState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setCurrency = useCallback((next: string) => {
    setCurrencyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const format = useCallback(
    (value: number | string | null, from = "USD") => {
      const amount = typeof value === "string" ? Number(value) : (value ?? 0);
      const fromRate = CURRENCY_RATES[from] ?? 1;
      const toRate = CURRENCY_RATES[currency] ?? 1;
      const converted = (amount / fromRate) * toRate;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(converted);
    },
    [currency],
  );

  const value = useMemo(() => ({ currency, setCurrency, format }), [currency, setCurrency, format]);

  return (
    <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) throw new Error("useDisplayCurrency must be used inside DisplayCurrencyProvider");
  return ctx;
}
