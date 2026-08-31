-- 1. Split equities into global/local
ALTER TYPE public.asset_class RENAME TO asset_class_old;
CREATE TYPE public.asset_class AS ENUM ('global_equity','local_equity','fixed_income','money_market','real_estate','alternatives');

ALTER TABLE public.products
  ALTER COLUMN asset_class TYPE public.asset_class
  USING (CASE
    WHEN asset_class::text = 'equities' AND ticker IN ('PAF-GRW') THEN 'global_equity'
    WHEN asset_class::text = 'equities' THEN 'local_equity'
    ELSE asset_class::text
  END)::public.asset_class;

DROP TYPE public.asset_class_old;

-- 2. More sample products
INSERT INTO public.products (name, ticker, asset_class, currency, price, previous_price, price_mode, price_source, price_updated_at) VALUES
  ('Sankore Global Equity Feeder','SNK-GEF','global_equity','USD',248.9000,244.1500,'automated','Bloomberg EQ Feed', now() - interval '2 hours'),
  ('MSCI World Index Tracker','MSCI-WLD','global_equity','USD',412.7500,409.2000,'automated','Refinitiv', now() - interval '3 hours'),
  ('US Tech Leaders Basket','USTECH','global_equity','USD',518.4000,527.9000,'automated','Bloomberg EQ Feed', now() - interval '90 minutes'),
  ('Emerging Markets Equity Fund','EM-EQF','global_equity','USD',96.3000,95.1000,'manual','Investment Committee', now() - interval '6 days'),
  ('MTN Nigeria Communications','MTNN','local_equity','USD',12.4500,12.1000,'automated','NGX Live', now() - interval '45 minutes'),
  ('Zenith Bank Plc','ZENITHBANK','local_equity','USD',3.1200,3.2400,'automated','NGX Live', now() - interval '45 minutes'),
  ('Nestle Nigeria Plc','NESTLE','local_equity','USD',68.7000,67.9500,'manual','Dealing Desk', now() - interval '3 days'),
  ('Sankore Ghana Equity Fund','SNK-GHE','local_equity','USD',54.2000,53.4000,'manual','Dealing Desk', now() - interval '9 days');

INSERT INTO public.price_history (product_id, old_price, new_price, mode, source, occurred_at)
SELECT p.id, p.previous_price, p.price, p.price_mode, p.price_source, p.price_updated_at
FROM public.products p
WHERE p.ticker IN ('SNK-GEF','MSCI-WLD','USTECH','EM-EQF','MTNN','ZENITHBANK','NESTLE','SNK-GHE');

INSERT INTO public.price_history (product_id, old_price, new_price, mode, source, occurred_at)
SELECT p.id, p.previous_price * 0.98, p.previous_price, p.price_mode, p.price_source, p.price_updated_at - interval '1 day'
FROM public.products p
WHERE p.ticker IN ('SNK-GEF','MSCI-WLD','USTECH','MTNN','ZENITHBANK');

-- 3. Holdings for the new products, spread across existing clients
INSERT INTO public.client_holdings (client_id, product_id, units, avg_cost)
SELECT c.id, p.id,
       round((random() * 900 + 60)::numeric, 2),
       round((p.price * (0.82 + random() * 0.3))::numeric, 4)
FROM public.clients c
CROSS JOIN public.products p
WHERE p.ticker IN ('SNK-GEF','MSCI-WLD','USTECH','EM-EQF','MTNN','ZENITHBANK','NESTLE','SNK-GHE')
  AND random() < 0.55
ON CONFLICT DO NOTHING;

-- 4. Rich ledger + audit trail for every existing account
DO $$
DECLARE
  acct public.accounts;
  i int;
  n int;
  is_credit boolean;
  amt numeric(18,2);
  bal numeric(18,2);
  new_bal numeric(18,2);
  ts timestamptz;
  txn public.transactions;
  cps text[] := ARRAY[
    'Adebayo Holdings Limited','Sahara Energy Partners Plc','Zenith Agro Industries Ltd',
    'Accra Maritime Group','Northgate Capital LLP','Adaeze Okonkwo','Chinedu Balogun',
    'Folasade Adeyemi','Ngozi Eze','Kwame Mensah','Wanjiru Kamau','Thabo Molefe',
    'Ibrahim Suleiman','Zainab Bello','Charlotte Whitfield','Daniel Rosenberg','Marie Dubois',
    'NGX Clearing House','FGN Bond Auction','Custodian Sweep — Stanbic IBTC'
  ];
  descs text[] := ARRAY[
    'Client subscription settlement','Redemption payout','Management fee sweep',
    'Coupon receipt — FGN 2031','Dividend receipt — GTCO','Custody fee settlement',
    'Broker commission','Treasury bill rollover','Cash inflow reconciliation',
    'Wire transfer out','FX conversion settlement','Performance fee accrual'
  ];
  ips text[] := ARRAY['102.89.34.17','197.210.55.201','41.58.120.9','154.113.8.44','80.248.2.190','196.46.20.7'];
BEGIN
  FOR acct IN SELECT * FROM public.accounts LOOP
    bal := acct.balance;
    n := 42;
    FOR i IN 1..n LOOP
      ts := now() - ((n - i) * interval '7 hours') - (random() * interval '3 hours');
      is_credit := (random() < 0.58) OR bal < 20000;
      amt := round((random() * 48000 + 1500)::numeric, 2);
      IF NOT is_credit AND amt > bal THEN
        amt := round((bal * 0.35)::numeric, 2);
      END IF;
      IF amt <= 0 THEN CONTINUE; END IF;
      new_bal := CASE WHEN is_credit THEN bal + amt ELSE bal - amt END;

      INSERT INTO public.transactions
        (account_id, user_id, type, status, amount, currency, description, counterparty,
         balance_before, balance_after, ip_address, created_at)
      VALUES (acct.id, acct.user_id,
        (CASE WHEN is_credit THEN 'credit' ELSE 'debit' END)::public.txn_type,
        (CASE WHEN i = n THEN 'pending' ELSE 'completed' END)::public.txn_status,
        amt, acct.currency,
        descs[1 + floor(random() * array_length(descs,1))::int],
        cps[1 + floor(random() * array_length(cps,1))::int],
        bal, new_bal,
        ips[1 + floor(random() * array_length(ips,1))::int],
        ts)
      RETURNING * INTO txn;

      INSERT INTO public.audit_logs
        (occurred_at, user_id, entity, entity_id, action, ip_address, previous_state, new_state)
      VALUES (ts, acct.user_id, 'transactions', txn.id::text,
        'post_' || txn.type::text, txn.ip_address,
        jsonb_build_object('balance', bal, 'status', 'draft'),
        jsonb_build_object('balance', new_bal, 'amount', amt, 'reference', txn.reference, 'status', txn.status));

      bal := new_bal;
    END LOOP;

    UPDATE public.accounts SET balance = bal WHERE id = acct.id;

    INSERT INTO public.audit_logs (occurred_at, user_id, entity, entity_id, action, ip_address, previous_state, new_state)
    VALUES
      (now() - interval '9 days', acct.user_id, 'accounts', acct.id::text, 'verify', ips[1],
        jsonb_build_object('is_verified', false), jsonb_build_object('is_verified', true)),
      (now() - interval '6 days', acct.user_id, 'products', NULL, 'price_update', ips[2],
        jsonb_build_object('price', 240.10, 'mode', 'manual'), jsonb_build_object('price', 248.90, 'mode', 'automated', 'source', 'Bloomberg EQ Feed')),
      (now() - interval '4 days', acct.user_id, 'cash_transactions', NULL, 'submit_for_review', ips[3],
        jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'pending_review', 'amount', 125000)),
      (now() - interval '2 days', acct.user_id, 'cash_transactions', NULL, 'approve', ips[4],
        jsonb_build_object('status', 'pending_approval'), jsonb_build_object('status', 'approved', 'amount', 125000)),
      (now() - interval '20 hours', acct.user_id, 'import_batches', NULL, 'csv_import', ips[5],
        jsonb_build_object('rows', 0), jsonb_build_object('rows', 34, 'matched', 31, 'unmatched', 3));
  END LOOP;
END $$;

-- 5. More cash operations awaiting review / approval
INSERT INTO public.cash_transactions
  (client_id, source_name, direction, amount, currency, value_date, narration, evidence_ref, evidence_note, entry_source, status, submitted_at)
SELECT c.id, c.name,
  (CASE WHEN random() < 0.75 THEN 'inflow' ELSE 'outflow' END)::public.cash_direction,
  round((random() * 380000 + 15000)::numeric, 2), 'USD',
  (CURRENT_DATE - (floor(random() * 20))::int),
  'Sample cash movement for ' || c.name,
  'EOP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  'Bank advice attached',
  (CASE WHEN random() < 0.5 THEN 'single' ELSE 'csv' END),
  (ARRAY['pending_review','pending_approval','approved','rejected'])[1 + floor(random()*4)::int]::public.approval_status,
  now() - (random() * interval '18 days')
FROM public.clients c;

INSERT INTO public.notifications (kind, title, body, entity, entity_id, created_at)
SELECT 'approval_request',
  'Cash entry awaiting ' || CASE WHEN ct.status = 'pending_review' THEN 'review' ELSE 'approval' END,
  ct.source_name || ' · ' || to_char(ct.amount, 'FM999,999,999.00') || ' ' || ct.currency,
  'cash_transactions', ct.id::text, ct.submitted_at
FROM public.cash_transactions ct
WHERE ct.status IN ('pending_review','pending_approval');