const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateTotalConsideration(dirtyPrice, units, faceValue = 100) {
  return (dirtyPrice / 100) * faceValue * units;
}

async function main() {
  const txs = await prisma.securityTransaction.findMany({
    where: { symbol: { contains: "2034" } },
    orderBy: { value_date: 'asc' }
  });
  
  let realizedGain = 0;
  let lots = [];
  
  txs.forEach(tx => {
    const dirtyPrice = tx.price;
    const trancheFaceValue = tx.units; // face value in nominal terms
    const faceValue = 100;
    
    if (tx.direction === "BUY") {
      let remainingFaceToBuy = trancheFaceValue;
      let trancheCost = calculateTotalConsideration(dirtyPrice, trancheFaceValue / 100, faceValue);
      
      while (remainingFaceToBuy > 0.01 && lots.length > 0 && lots[0].faceValue < -0.01) {
         const lot = lots[0];
         const shortFace = Math.abs(lot.faceValue);
         
         if (shortFace <= remainingFaceToBuy + 0.01) {
            const costOfCover = (trancheCost / trancheFaceValue) * shortFace;
            realizedGain += (lot.cost - costOfCover);
            remainingFaceToBuy -= shortFace;
            lots.shift();
         } else {
            const fractionCovered = remainingFaceToBuy / shortFace;
            const proceedsOfCovered = lot.cost * fractionCovered;
            const costOfCover = (trancheCost / trancheFaceValue) * remainingFaceToBuy;
            
            realizedGain += (proceedsOfCovered - costOfCover);
            lot.faceValue += remainingFaceToBuy;
            lot.units += remainingFaceToBuy / 100;
            lot.cost -= proceedsOfCovered;
            remainingFaceToBuy = 0;
         }
      }
      
      if (remainingFaceToBuy > 0.01) {
         lots.push({
           units: remainingFaceToBuy / 100,
           faceValue: remainingFaceToBuy,
           cost: (trancheCost / trancheFaceValue) * remainingFaceToBuy,
           dirtyPrice
         });
      }
    } else if (tx.direction === "SELL") {
      let remainingFaceToSell = trancheFaceValue;
      
      while (remainingFaceToSell > 0.01 && lots.length > 0 && lots[0].faceValue > 0.01) {
        const lot = lots[0];
        
        if (lot.faceValue <= remainingFaceToSell + 0.01) {
           const soldFace = lot.faceValue;
           const soldUnits = lot.units;
           const costOfSold = lot.cost;
           const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
           realizedGain += (saleProceeds - costOfSold);
           
           remainingFaceToSell -= soldFace;
           lots.shift(); 
        } else {
           const fractionSold = remainingFaceToSell / lot.faceValue;
           const costOfSold = lot.cost * fractionSold;
           const soldUnits = remainingFaceToSell / 100; 
           const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
           
           realizedGain += (saleProceeds - costOfSold);
           lot.faceValue -= remainingFaceToSell;
           lot.units -= soldUnits;
           lot.cost -= costOfSold;
           remainingFaceToSell = 0;
        }
      }
      
      if (remainingFaceToSell > 0.01) {
         const soldUnits = remainingFaceToSell / 100;
         const saleProceeds = calculateTotalConsideration(dirtyPrice, soldUnits, faceValue);
         lots.push({
           units: -soldUnits,
           faceValue: -remainingFaceToSell,
           cost: saleProceeds,
           dirtyPrice
         });
      }
    }
  });

  console.log("Realized Gain:", realizedGain);
  console.log("Remaining Lots:", lots.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
