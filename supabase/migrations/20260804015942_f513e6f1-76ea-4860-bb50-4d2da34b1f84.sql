-- ============ ENUMS ============
CREATE TYPE public.account_status AS ENUM ('active','frozen','closed');
CREATE TYPE public.txn_type AS ENUM ('credit','debit');
CREATE TYPE public.txn_status AS ENUM ('pending','completed','failed','reversed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_number text NOT NULL UNIQUE,
  bank_name text NOT NULL DEFAULT 'Sankore Trust',
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(18,2) NOT NULL DEFAULT 0,
  allow_negative boolean NOT NULL DEFAULT false,
  status public.account_status NOT NULL DEFAULT 'active',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_balance_non_negative CHECK (allow_negative OR balance >= 0)
);
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts read" ON public.accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own accounts insert" ON public.accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own accounts update" ON public.accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX accounts_user_idx ON public.accounts(user_id);

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  type public.txn_type NOT NULL,
  status public.txn_status NOT NULL DEFAULT 'completed',
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reference text NOT NULL UNIQUE DEFAULT ('SK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  description text,
  counterparty text,
  balance_before numeric(18,2),
  balance_after numeric(18,2),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_amount_positive CHECK (amount > 0)
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions read" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX transactions_user_created_idx ON public.transactions(user_id, created_at DESC);
CREATE INDEX transactions_account_idx ON public.transactions(account_id);

-- ============ AUDIT LOG (immutable) ============
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  actor_email text,
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  ip_address text,
  previous_state jsonb,
  new_state jsonb
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX audit_logs_user_idx ON public.audit_logs(user_id, occurred_at DESC);

-- block mutation of audit entries for every role
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified';
END;
$$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- block mutation of committed transactions (immutable ledger)
CREATE OR REPLACE FUNCTION public.block_txn_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable; post a reversing entry instead';
END;
$$;
CREATE TRIGGER transactions_no_delete BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.block_txn_mutation();

-- ============ TIMESTAMPS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER accounts_touch BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NEW USER BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.accounts (user_id, account_name, account_number, is_verified, balance)
  VALUES (NEW.id, 'Operating Account',
          'SNK-' || lpad((floor(random()*100000000))::bigint::text, 8, '0'),
          true, 0);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ACCOUNT VERIFICATION (TM-03) ============
CREATE OR REPLACE FUNCTION public.verify_account_details(
  _account_id uuid, _account_number text, _bank_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.accounts; failures text[] := '{}';
BEGIN
  SELECT * INTO acct FROM public.accounts WHERE id = _account_id AND user_id = auth.uid();
  IF acct.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'failures', to_jsonb(ARRAY['Account not found']));
  END IF;
  IF acct.status <> 'active' THEN failures := failures || 'Account is not active'; END IF;
  IF _account_number IS NOT NULL AND upper(trim(_account_number)) <> upper(acct.account_number)
    THEN failures := failures || 'Account number mismatch'; END IF;
  IF _bank_name IS NOT NULL AND lower(trim(_bank_name)) <> lower(acct.bank_name)
    THEN failures := failures || 'Institution name mismatch'; END IF;

  IF array_length(failures,1) IS NULL THEN
    UPDATE public.accounts SET is_verified = true WHERE id = acct.id;
    INSERT INTO public.audit_logs (user_id, entity, entity_id, action, previous_state, new_state)
    VALUES (auth.uid(), 'accounts', acct.id::text, 'verify',
            jsonb_build_object('is_verified', acct.is_verified),
            jsonb_build_object('is_verified', true));
    RETURN jsonb_build_object('ok', true, 'failures', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('ok', false, 'failures', to_jsonb(failures));
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_account_details(uuid, text, text) TO authenticated;

-- ============ BALANCE ENGINE (TM-01/02/04) ============
CREATE OR REPLACE FUNCTION public.post_transaction(
  _account_id uuid,
  _type public.txn_type,
  _amount numeric,
  _description text DEFAULT NULL,
  _counterparty text DEFAULT NULL,
  _ip_address text DEFAULT NULL
) RETURNS public.transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.accounts; new_balance numeric(18,2); txn public.transactions; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  -- lock the row so concurrent commits cannot race the balance
  SELECT * INTO acct FROM public.accounts
    WHERE id = _account_id AND user_id = uid FOR UPDATE;
  IF acct.id IS NULL THEN RAISE EXCEPTION 'Account not found or not owned by caller'; END IF;
  IF acct.status <> 'active' THEN RAISE EXCEPTION 'Account is % and cannot transact', acct.status; END IF;
  IF NOT acct.is_verified THEN RAISE EXCEPTION 'Account details must be verified before authorizing transactions'; END IF;

  new_balance := CASE WHEN _type = 'credit' THEN acct.balance + _amount ELSE acct.balance - _amount END;
  IF new_balance < 0 AND NOT acct.allow_negative THEN
    RAISE EXCEPTION 'Insufficient funds: balance cannot go negative on this account';
  END IF;

  INSERT INTO public.transactions
    (account_id, user_id, type, status, amount, currency, description, counterparty,
     balance_before, balance_after, ip_address)
  VALUES (acct.id, uid, _type, 'completed', _amount, acct.currency, _description, _counterparty,
          acct.balance, new_balance, _ip_address)
  RETURNING * INTO txn;

  UPDATE public.accounts SET balance = new_balance WHERE id = acct.id;

  INSERT INTO public.audit_logs
    (user_id, entity, entity_id, action, ip_address, previous_state, new_state)
  VALUES (uid, 'transactions', txn.id::text, 'post_' || _type::text, _ip_address,
          jsonb_build_object('balance', acct.balance),
          jsonb_build_object('balance', new_balance, 'amount', _amount, 'reference', txn.reference));

  RETURN txn;
END;
$$;
GRANT EXECUTE ON FUNCTION public.post_transaction(uuid, public.txn_type, numeric, text, text, text) TO authenticated;

-- realtime for sub-second balance/ledger updates
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;