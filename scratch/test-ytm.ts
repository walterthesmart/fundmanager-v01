import { calculateDirtyPriceFromYTM } from "../src/lib/bond-math";

function findYtm(
  targetDirtyPrice: number,
  couponRate: number,
  settlementDate: Date,
  maturityDate: Date,
  couponFreq: number,
  faceValue: number = 100
): number {
  let low = -50; // allow negative yields just in case
  let high = 200;
  let mid = 0;
  
  // binary search
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const price = calculateDirtyPriceFromYTM(mid, couponRate, settlementDate, maturityDate, couponFreq, faceValue);
    
    if (Math.abs(price - targetDirtyPrice) < 0.0001) {
      return mid;
    }
    
    // Price and YTM are inversely related
    if (price > targetDirtyPrice) {
      low = mid; // higher yield -> lower price
    } else {
      high = mid; // lower yield -> higher price
    }
  }
  
  return mid;
}

const settlementDate = new Date("2025-04-01");
const maturityDate = new Date("2031-01-21");
const ytm = findYtm(98.02580556, 8.75, settlementDate, maturityDate, 2);

console.log("Calculated YTM:", ytm);
console.log("Target price: 98.02580556, Calculated Price:", calculateDirtyPriceFromYTM(ytm, 8.75, settlementDate, maturityDate, 2));
