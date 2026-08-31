-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','approver','reviewer','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CLIENTS
CREATE TYPE public.client_type AS ENUM ('individual','corporate');

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_type public.client_type NOT NULL DEFAULT 'individual',
  identifier text NOT NULL,
  email text,
  phone text,
  country text,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  cash_balance numeric(18,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients read" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients update" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PRODUCTS
CREATE TYPE public.asset_class AS ENUM ('equities','fixed_income','money_market','real_estate','alternatives');
CREATE TYPE public.price_mode AS ENUM ('manual','automated');

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ticker text NOT NULL,
  asset_class public.asset_class NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  price numeric(18,4) NOT NULL DEFAULT 0,
  previous_price numeric(18,4),
  price_mode public.price_mode NOT NULL DEFAULT 'manual',
  price_source text,
  price_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products insert" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products update" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.price_history (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price numeric(18,4),
  new_price numeric(18,4) NOT NULL,
  mode public.price_mode NOT NULL DEFAULT 'manual',
  source text,
  changed_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.price_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.price_history_id_seq TO authenticated;
GRANT ALL ON public.price_history TO service_role;
GRANT ALL ON SEQUENCE public.price_history_id_seq TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price history read" ON public.price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "price history insert" ON public.price_history FOR INSERT TO authenticated WITH CHECK (true);

-- HOLDINGS
CREATE TABLE public.client_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units numeric(18,4) NOT NULL DEFAULT 0,
  avg_cost numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_holdings TO authenticated;
GRANT ALL ON public.client_holdings TO service_role;
ALTER TABLE public.client_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holdings read" ON public.client_holdings FOR SELECT TO authenticated USING (true);
CREATE POLICY "holdings write" ON public.client_holdings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER holdings_touch BEFORE UPDATE ON public.client_holdings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- IMPORT BATCHES
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'cash',
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches read" ON public.import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches insert" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "batches update" ON public.import_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- CASH TRANSACTIONS (approval workflow)
CREATE TYPE public.cash_direction AS ENUM ('inflow','outflow');
CREATE TYPE public.approval_status AS ENUM ('pending_review','pending_approval','approved','rejected');

CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  source_name text,
  direction public.cash_direction NOT NULL DEFAULT 'inflow',
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  value_date date NOT NULL DEFAULT current_date,
  reference text NOT NULL DEFAULT ('CSH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  narration text,
  evidence_ref text,
  evidence_note text,
  entry_source text NOT NULL DEFAULT 'single',
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  status public.approval_status NOT NULL DEFAULT 'pending_review',
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cash_transactions TO authenticated;
GRANT ALL ON public.cash_transactions TO service_role;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash read" ON public.cash_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cash insert" ON public.cash_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cash update" ON public.cash_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER cash_touch BEFORE UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL DEFAULT 'approval_request',
  title text NOT NULL,
  body text,
  entity text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid()) WITH CHECK (true);

-- SAMPLE DATA
INSERT INTO public.clients (name, client_type, identifier, email, phone, country, currency, cash_balance) VALUES
 ('Adaeze Okonkwo','individual','SNK-CL-0001','adaeze.okonkwo@example.com','+234 803 114 2290','Nigeria','USD',48250.00),
 ('Chinedu Balogun','individual','SNK-CL-0002','chinedu.balogun@example.com','+234 805 771 0932','Nigeria','USD',12980.50),
 ('Folasade Adeyemi','individual','SNK-CL-0003','folasade.adeyemi@example.com','+234 810 442 8871','Nigeria','USD',96500.00),
 ('Oluwaseun Ogunleye','individual','SNK-CL-0004','seun.ogunleye@example.com','+234 802 330 1174','Nigeria','USD',7400.00),
 ('Ngozi Eze','individual','SNK-CL-0005','ngozi.eze@example.com','+234 806 918 4412','Nigeria','USD',153200.75),
 ('Kwame Mensah','individual','SNK-CL-0006','kwame.mensah@example.com','+233 24 551 8830','Ghana','USD',33100.00),
 ('Amara Nwosu','individual','SNK-CL-0007','amara.nwosu@example.com','+234 809 220 7741','Nigeria','USD',20500.00),
 ('Thabo Molefe','individual','SNK-CL-0008','thabo.molefe@example.com','+27 82 447 1120','South Africa','USD',61750.00),
 ('Wanjiru Kamau','individual','SNK-CL-0009','wanjiru.kamau@example.com','+254 722 118 903','Kenya','USD',18900.00),
 ('Ibrahim Suleiman','individual','SNK-CL-0010','ibrahim.suleiman@example.com','+234 807 664 2201','Nigeria','USD',44300.00),
 ('Emeka Chukwu','individual','SNK-CL-0011','emeka.chukwu@example.com','+234 813 990 4417','Nigeria','USD',9800.00),
 ('Zainab Bello','individual','SNK-CL-0012','zainab.bello@example.com','+234 811 305 7729','Nigeria','USD',77600.00),
 ('Charlotte Whitfield','individual','SNK-CL-0013','c.whitfield@example.co.uk','+44 7700 900312','United Kingdom','USD',88200.00),
 ('Daniel Rosenberg','individual','SNK-CL-0014','d.rosenberg@example.com','+1 415 555 0139','United States','USD',129400.00),
 ('Marie Dubois','individual','SNK-CL-0015','marie.dubois@example.fr','+33 6 12 44 90 21','France','USD',54300.00),
 ('Adebayo Holdings Limited','corporate','SNK-CO-0001','treasury@adebayoholdings.com','+234 1 460 2210','Nigeria','USD',412000.00),
 ('Sahara Energy Partners Plc','corporate','SNK-CO-0002','finance@saharaenergy.example','+234 1 271 9004','Nigeria','USD',985400.00),
 ('Zenith Agro Industries Ltd','corporate','SNK-CO-0003','accounts@zenithagro.example','+234 1 700 3318','Nigeria','USD',233750.00),
 ('Accra Maritime Group','corporate','SNK-CO-0004','treasury@accramaritime.example','+233 30 274 1180','Ghana','USD',176300.00),
 ('Northgate Capital LLP','corporate','SNK-CO-0005','ops@northgatecapital.example','+44 20 7946 0821','United Kingdom','USD',640500.00);

INSERT INTO public.products (name, ticker, asset_class, currency, price, previous_price, price_mode, price_source, price_updated_at) VALUES
 ('Sankore Nigerian Equity Fund','SNK-EQF','equities','USD',142.5500,140.1200,'automated','NGX Market Feed', now() - interval '2 hours'),
 ('Pan-African Growth Equities','PAF-GRW','equities','USD',88.4000,89.9500,'automated','Refinitiv', now() - interval '3 hours'),
 ('Dangote Cement Plc','DANGCEM','equities','USD',31.2000,30.4500,'manual',NULL, now() - interval '2 days'),
 ('GTCO Holdings','GTCO','equities','USD',2.9800,2.8700,'automated','NGX Market Feed', now() - interval '2 hours'),
 ('FGN Bond 2031 Series','FGN-2031','fixed_income','USD',101.8500,101.4000,'manual',NULL, now() - interval '5 days'),
 ('Sankore Eurobond Fund','SNK-EURO','fixed_income','USD',119.7500,119.9000,'automated','Bloomberg', now() - interval '1 hour'),
 ('Corporate Credit Note 2028','CCN-2028','fixed_income','USD',97.3000,97.3000,'manual',NULL, now() - interval '12 days'),
 ('Sankore Treasury Bill Fund','SNK-TBF','money_market','USD',1.0450,1.0430,'automated','CBN OMO Rates', now() - interval '30 minutes'),
 ('Naira Liquidity Fund','NLF-MMF','money_market','USD',1.0120,1.0110,'automated','CBN OMO Rates', now() - interval '30 minutes'),
 ('Lagos Prime Real Estate Trust','LPR-REIT','real_estate','USD',56.9000,55.2500,'manual',NULL, now() - interval '9 days'),
 ('Accra Commercial Property Fund','ACC-PROP','real_estate','USD',44.1500,44.8000,'manual',NULL, now() - interval '20 days'),
 ('Sankore Private Credit I','SNK-PC1','alternatives','USD',1120.0000,1098.0000,'manual',NULL, now() - interval '1 day'),
 ('West Africa Infrastructure SPV','WAI-SPV','alternatives','USD',805.5000,805.5000,'manual',NULL, now() - interval '31 days'),
 ('Global Commodity Basket','GLB-COM','alternatives','USD',212.4000,208.9000,'automated','ICE Data Services', now() - interval '4 hours');

INSERT INTO public.client_holdings (client_id, product_id, units, avg_cost)
SELECT c.id, p.id,
       round((20 + (abs(hashtext(c.identifier || p.ticker)) % 900))::numeric, 2),
       round((p.price * (0.82 + ((abs(hashtext(p.ticker || c.identifier)) % 30)::numeric / 100)))::numeric, 4)
FROM public.clients c
JOIN public.products p ON (abs(hashtext(c.identifier || p.ticker)) % 10) < 5;

INSERT INTO public.price_history (product_id, old_price, new_price, mode, source, occurred_at)
SELECT id, previous_price, price, price_mode, price_source, price_updated_at FROM public.products;

INSERT INTO public.cash_transactions
  (client_id, source_name, direction, amount, currency, value_date, narration, evidence_ref, entry_source, status, approved_at, decision_note)
SELECT c.id, c.name, 'inflow'::public.cash_direction, v.amount, 'USD', current_date - v.d, v.narration, v.ev, v.src, v.st::public.approval_status,
       CASE WHEN v.st = 'approved' THEN now() - (v.d || ' days')::interval END,
       CASE WHEN v.st = 'approved' THEN 'Evidence verified against bank statement' END
FROM (VALUES
  ('SNK-CL-0001', 25000.00, 1, 'Bank transfer inflow', 'EOP-88213', 'single', 'pending_approval'),
  ('SNK-CL-0003', 40000.00, 2, 'Quarterly subscription', 'EOP-88214', 'csv', 'pending_review'),
  ('SNK-CO-0002', 250000.00, 3, 'Treasury sweep inflow', 'EOP-88215', 'csv', 'pending_approval'),
  ('SNK-CL-0005', 15000.00, 4, 'Top-up from GTBank', 'EOP-88216', 'single', 'approved'),
  ('SNK-CO-0001', 120000.00, 5, 'Corporate mandate funding', 'EOP-88217', 'csv', 'approved'),
  ('SNK-CL-0013', 30000.00, 6, 'Wire from Barclays', 'EOP-88218', 'single', 'pending_review'),
  ('SNK-CL-0014', 75000.00, 8, 'USD wire inflow', 'EOP-88219', 'single', 'approved'),
  ('SNK-CO-0005', 180000.00, 10, 'LLP capital call inflow', 'EOP-88220', 'csv', 'approved')
) AS v(ident, amount, d, narration, ev, src, st)
JOIN public.clients c ON c.identifier = v.ident;

UPDATE public.cash_transactions SET status = 'pending_review'::public.approval_status WHERE status IS NULL;

INSERT INTO public.notifications (kind, title, body, entity, entity_id)
SELECT 'approval_request',
       'Cash inflow awaiting approval',
       ct.source_name || ' · ' || to_char(ct.amount,'FM999,999,999.00') || ' ' || ct.currency,
       'cash_transactions', ct.id::text
FROM public.cash_transactions ct WHERE ct.status <> 'approved';