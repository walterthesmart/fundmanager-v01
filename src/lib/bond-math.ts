import { differenceInDays, addMonths, subMonths, isBefore, isAfter } from "date-fns";

/**
 * Gets the most recent coupon date before the reference date
 */
export function getPreviousCouponDate(maturityDate: Date, couponFreq: number, referenceDate: Date): Date {
  const monthsBetween = 12 / (couponFreq || 2);
  let d = new Date(maturityDate);

  if (isBefore(d, referenceDate)) return d;

  while (isAfter(d, referenceDate)) {
    d = subMonths(d, monthsBetween);
  }
  
  return d;
}

/**
 * Gets the next coupon date after the reference date
 */
export function getNextCouponDate(maturityDate: Date, couponFreq: number, referenceDate: Date): Date {
  const monthsBetween = 12 / (couponFreq || 2);
  let d = new Date(maturityDate);

  if (isBefore(d, referenceDate)) return d;

  while (isAfter(d, referenceDate)) {
    d = subMonths(d, monthsBetween);
  }
  
  return addMonths(d, monthsBetween);
}

/**
 * Calculates accrued interest using Actual/Actual or Actual/365 (standardized to period ratios)
 */
export function calculateAccruedInterest(
  faceValue: number,
  couponRate: number,
  maturityDate: Date,
  couponFreq: number,
  settlementDate: Date = new Date()
): number {
  if (!couponRate || !maturityDate) return 0;
  
  const prevCouponDate = getPreviousCouponDate(maturityDate, couponFreq, settlementDate);
  const nextCouponDate = getNextCouponDate(maturityDate, couponFreq, settlementDate);
  
  const daysInPeriod = differenceInDays(nextCouponDate, prevCouponDate);
  const daysAccrued = Math.max(0, differenceInDays(settlementDate, prevCouponDate));
  
  // Accrued fraction
  const fraction = daysInPeriod > 0 ? daysAccrued / daysInPeriod : 0;
  const couponPmt = faceValue * (couponRate / 100) / couponFreq;
  
  return couponPmt * fraction;
}

/**
 * Calculates the total cash amount of coupons received between a settlement date and a reference date (today).
 */
export function calculateCouponsReceived(
  faceValue: number,
  couponRate: number,
  maturityDate: Date,
  couponFreq: number,
  settlementDate: Date,
  referenceDate: Date = new Date()
): number {
  if (!couponRate || !maturityDate || isAfter(settlementDate, referenceDate)) return 0;
  
  let totalCoupons = 0;
  const couponPmt = faceValue * (couponRate / 100) / (couponFreq || 2);
  
  let nextDate = getNextCouponDate(maturityDate, couponFreq, settlementDate);
  
  // As long as the next coupon date is on or before our reference date, we received the cash
  // We use differenceInDays to allow for same-day precision without time issues
  while (differenceInDays(referenceDate, nextDate) >= 0) {
    totalCoupons += couponPmt;
    nextDate = getNextCouponDate(maturityDate, couponFreq, nextDate);
  }
  
  return totalCoupons;
}

/**
 * Calculates Dirty Price from Yield to Maturity (YTM)
 * Using standard fixed income present value discounting
 */
export function calculateDirtyPriceFromYTM(
  ytm: number,
  couponRate: number,
  settlementDate: Date,
  maturityDate: Date,
  couponFreq: number,
  faceValue: number = 100
): number {
  if (ytm == null || !maturityDate || !settlementDate) return 0;
  if (isAfter(settlementDate, maturityDate)) return 0;

  const ytmDec = ytm / 100;
  const couponDec = couponRate / 100;
  const couponPmt = (faceValue * couponDec) / couponFreq;
  
  // Generate all future cash flow dates
  const cashFlowDates: Date[] = [];
  let d = new Date(maturityDate);
  const monthsBetween = 12 / couponFreq;
  
  while (isAfter(d, settlementDate) || d.getTime() === settlementDate.getTime()) {
    cashFlowDates.push(new Date(d));
    d = subMonths(d, monthsBetween);
  }
  
  cashFlowDates.reverse(); // from soonest to latest
  if (cashFlowDates.length === 0) return 0;

  const nextCouponDate = getNextCouponDate(maturityDate, couponFreq, settlementDate);
  const prevCouponDate = getPreviousCouponDate(maturityDate, couponFreq, settlementDate);
  
  const daysInPeriod = differenceInDays(nextCouponDate, prevCouponDate);
  const daysToNextCoupon = differenceInDays(nextCouponDate, settlementDate);
  
  const w = daysInPeriod === 0 ? 0 : daysToNextCoupon / daysInPeriod;
  
  let presentValue = 0;
  const yieldPerPeriod = ytmDec / couponFreq;
  
  for (let i = 0; i < cashFlowDates.length; i++) {
    let cf = couponPmt;
    if (i === cashFlowDates.length - 1) cf += faceValue;
    
    const periods = w + i;
    presentValue += cf / Math.pow(1 + yieldPerPeriod, periods);
  }
  
  return presentValue;
}

/**
 * Calculates Clean Price
 */
export function calculateCleanPrice(
  ytm: number,
  couponRate: number,
  settlementDate: Date,
  maturityDate: Date,
  couponFreq: number,
  faceValue: number = 100
): number {
  const dirty = calculateDirtyPriceFromYTM(ytm, couponRate, settlementDate, maturityDate, couponFreq, faceValue);
  const accrued = calculateAccruedInterest(faceValue, couponRate, maturityDate, couponFreq, settlementDate);
  return dirty - accrued;
}

/**
 * Calculates Total Consideration
 */
export function calculateTotalConsideration(dirtyPrice: number, units: number, faceValue: number = 100): number {
  return (dirtyPrice / 100) * faceValue * units;
}

/**
 * Approximates Yield to Maturity (YTM) from price (for backward compatibility or reverse calc)
 */
export function calculateYTM(
  price: number,
  couponRate: number,
  maturityDate: Date,
  faceValue: number = 100,
  referenceDate: Date = new Date()
): number {
  if (!couponRate || !maturityDate || price <= 0) return 0;

  const yearsToMaturity = Math.max(0, differenceInDays(maturityDate, referenceDate) / 365);
  if (yearsToMaturity === 0) return 0;

  const annualCoupon = faceValue * (couponRate / 100);
  
  // Approximation Formula: YTM = [C + (F - P) / n] / [(F + P) / 2]
  const numerator = annualCoupon + (faceValue - price) / yearsToMaturity;
  const denominator = (faceValue + price) / 2;
  
  return (numerator / denominator) * 100;
}

// ─── T-BILL / ZERO-COUPON FUNCTIONS ────────────────────────────────────────

/**
 * Checks if an instrument is a zero-coupon / T-Bill (coupon rate is 0 or null)
 */
export function isZeroCoupon(couponRate: number | null | undefined): boolean {
  return !couponRate || couponRate === 0;
}

/**
 * Calculates T-Bill price using Nigerian simple discount convention (Actual/365).
 * Price = 100 × (1 − Rate × Days_to_Maturity / 365)
 */
export function calculateTBillPrice(
  discountRate: number,
  settlementDate: Date,
  maturityDate: Date
): number {
  if (!maturityDate || discountRate == null) return 100;
  const days = Math.max(0, differenceInDays(maturityDate, settlementDate));
  if (days === 0) return 100;
  return 100 * (1 - (discountRate / 100) * (days / 365));
}

/**
 * Calculates T-Bill yield (discount rate) from price using simple discount convention.
 * Rate = (1 − Price/100) × 365 / Days_to_Maturity
 */
export function calculateTBillYield(
  price: number,
  settlementDate: Date,
  maturityDate: Date
): number {
  if (!maturityDate || price <= 0) return 0;
  const days = Math.max(0, differenceInDays(maturityDate, settlementDate));
  if (days === 0) return 0;
  return ((1 - price / 100) * 365 / days) * 100;
}

/**
 * Calculates T-Bill total consideration (no accrued interest).
 * Consideration = Price / 100 × Face Value
 */
export function calculateTBillConsideration(
  price: number,
  faceValue: number
): number {
  return (price / 100) * faceValue;
}
