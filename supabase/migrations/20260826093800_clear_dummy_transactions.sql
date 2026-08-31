DELETE FROM public.cash_transactions
WHERE narration IN (
  'Bank transfer inflow',
  'Quarterly subscription',
  'Treasury sweep inflow',
  'Top-up from GTBank',
  'Corporate mandate funding',
  'Wire from Barclays',
  'USD wire inflow',
  'LLP capital call inflow'
) OR narration LIKE 'Sample cash movement for %';

DELETE FROM public.transactions
WHERE description IN (
  'Monthly management fee',
  'Client subscription',
  'Redemption payment',
  'Dividend distribution',
  'Bond coupon received',
  'Wire transfer out',
  'FX conversion settlement',
  'Performance fee accrual'
)
OR counterparty IN (
  'Tania''s Nursery',
  'Robertson & Associates',
  'Books by Bessie',
  'Hicks Hardware',
  'Chin''s Gas and Oil',
  'Pam Seitz',
  'Bob''s Burger Joint',
  'Squeaky Kleen Car Wash',
  'QuickBooks Vendor'
);
