import { updateMarketPricesFromSheet } from './app/actions';

async function main() {
  console.log("Calling updateMarketPricesFromSheet...");
  const res = await updateMarketPricesFromSheet();
  console.log("Result:", res);
}

main().catch(console.error);
