import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const products = await p.product.findMany();
products.forEach(pr => console.log(pr.ticker, "|", pr.name, "|", pr.asset_class));
await p.$disconnect();
