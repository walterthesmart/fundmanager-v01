const { PrismaClient } = require('@prisma/client');
const { calculateCouponsReceived, isZeroCoupon } = require('./src/lib/bond-math.js'); // Assuming TS doesn't work directly here without compiling... wait, bond-math is TS!
