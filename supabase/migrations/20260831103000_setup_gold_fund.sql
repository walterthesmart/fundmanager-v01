-- Migration: Setup Gold Fund and populate transactions

DELETE FROM public.transactions;
DELETE FROM public.cash_transactions;
UPDATE public.accounts SET balance = 0;

INSERT INTO public.products (id, name, ticker, asset_class, currency, price_mode, price_source, price)
VALUES (gen_random_uuid(), 'Sankore Gold Fund', 'IAU', 'alternatives', 'USD', 'automated', 'yahoo-finance', 0)
ON CONFLICT DO NOTHING;

DO $$
DECLARE 
  _account_id uuid;
  _user_id uuid;
  _curr_balance numeric(18,2) := 0;
  _new_balance numeric(18,2) := 0;
BEGIN
  SELECT id, user_id INTO _account_id, _user_id FROM public.accounts LIMIT 1;

  IF _account_id IS NULL THEN
    RETURN;
  END IF;

  -- Transaction for Belinda Disu
  _new_balance := _curr_balance + 150000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 150000, 'USD', _curr_balance, _new_balance, 'Gold txn: Belinda Disu', 'Belinda Disu');
  _curr_balance := _new_balance;

  -- Transaction for Yewande Zaccheaus
  _new_balance := _curr_balance + 25000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 25000, 'USD', _curr_balance, _new_balance, 'Gold txn: Yewande Zaccheaus', 'Yewande Zaccheaus');
  _curr_balance := _new_balance;

  -- Transaction for Geraldine Lazarre
  _new_balance := _curr_balance + 24982.59;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 24982.59, 'USD', _curr_balance, _new_balance, 'Gold txn: Geraldine Lazarre', 'Geraldine Lazarre');
  _curr_balance := _new_balance;

  -- Transaction for Tania Teller
  _new_balance := _curr_balance + 4900;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 4900, 'USD', _curr_balance, _new_balance, 'Gold txn: Tania Teller', 'Tania Teller');
  _curr_balance := _new_balance;

  -- Transaction for Onyekachi Mbaike
  _new_balance := _curr_balance + 25000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 25000, 'USD', _curr_balance, _new_balance, 'Gold txn: Onyekachi Mbaike', 'Onyekachi Mbaike');
  _curr_balance := _new_balance;

  -- Transaction for Moyo Makanjuola
  _new_balance := _curr_balance + 7960;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 7960, 'USD', _curr_balance, _new_balance, 'Gold txn: Moyo Makanjuola', 'Moyo Makanjuola');
  _curr_balance := _new_balance;

  -- Transaction for Leona Asika
  _new_balance := _curr_balance + 9200;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 9200, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Asika', 'Leona Asika');
  _curr_balance := _new_balance;

  -- Transaction for Bolaji Olajide
  _new_balance := _curr_balance + 5000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 5000, 'USD', _curr_balance, _new_balance, 'Gold txn: Bolaji Olajide', 'Bolaji Olajide');
  _curr_balance := _new_balance;

  -- Transaction for Yewande Zaccheaus
  _new_balance := _curr_balance + 5000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 5000, 'USD', _curr_balance, _new_balance, 'Gold txn: Yewande Zaccheaus', 'Yewande Zaccheaus');
  _curr_balance := _new_balance;

  -- Transaction for Leona Adesanya and Asa Asika
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Adesanya and Asa Asika', 'Leona Adesanya and Asa Asika');
  _curr_balance := _new_balance;

  -- Transaction for Seike and Ted
  _new_balance := _curr_balance + 7500;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 7500, 'USD', _curr_balance, _new_balance, 'Gold txn: Seike and Ted', 'Seike and Ted');
  _curr_balance := _new_balance;

  -- Transaction for Ayomide Dokunmu
  _new_balance := _curr_balance + 20000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 20000, 'USD', _curr_balance, _new_balance, 'Gold txn: Ayomide Dokunmu', 'Ayomide Dokunmu');
  _curr_balance := _new_balance;

  -- Transaction for Salewa Osakwe
  _new_balance := _curr_balance + 6000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 6000, 'USD', _curr_balance, _new_balance, 'Gold txn: Salewa Osakwe', 'Salewa Osakwe');
  _curr_balance := _new_balance;

  -- Transaction for Bimbo Oguntunde
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Bimbo Oguntunde', 'Bimbo Oguntunde');
  _curr_balance := _new_balance;

  -- Transaction for Ogbonna Anosikeh
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Ogbonna Anosikeh', 'Ogbonna Anosikeh');
  _curr_balance := _new_balance;

  -- Transaction for Ogbonna Anosikeh
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Ogbonna Anosikeh', 'Ogbonna Anosikeh');
  _curr_balance := _new_balance;

  -- Transaction for Ogbonna Anosikeh
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Ogbonna Anosikeh', 'Ogbonna Anosikeh');
  _curr_balance := _new_balance;

  -- Transaction for Belinda Disu
  _new_balance := _curr_balance + 48207.76;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 48207.76, 'USD', _curr_balance, _new_balance, 'Gold txn: Belinda Disu', 'Belinda Disu');
  _curr_balance := _new_balance;

  -- Transaction for Ayomide Dokunmu
  _new_balance := _curr_balance + 20056.47;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 20056.47, 'USD', _curr_balance, _new_balance, 'Gold txn: Ayomide Dokunmu', 'Ayomide Dokunmu');
  _curr_balance := _new_balance;

  -- Transaction for Leona Adesanya and Asa Asika
  _new_balance := _curr_balance + 14980;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 14980, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Adesanya and Asa Asika', 'Leona Adesanya and Asa Asika');
  _curr_balance := _new_balance;

  -- Transaction for Christopher Ibru
  _new_balance := _curr_balance + 5110.96;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 5110.96, 'USD', _curr_balance, _new_balance, 'Gold txn: Christopher Ibru', 'Christopher Ibru');
  _curr_balance := _new_balance;

  -- Transaction for Leona Asika
  _new_balance := _curr_balance + 9404.16;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 9404.16, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Asika', 'Leona Asika');
  _curr_balance := _new_balance;

  -- Transaction for Bolaji Olajide
  _new_balance := _curr_balance + 10000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 10000, 'USD', _curr_balance, _new_balance, 'Gold txn: Bolaji Olajide', 'Bolaji Olajide');
  _curr_balance := _new_balance;

  -- Transaction for Moyo Makanjuola
  _new_balance := _curr_balance + 9683;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 9683, 'USD', _curr_balance, _new_balance, 'Gold txn: Moyo Makanjuola', 'Moyo Makanjuola');
  _curr_balance := _new_balance;

  -- Transaction for Zeebo Capitaux Limited
  _new_balance := _curr_balance + 33000;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 33000, 'USD', _curr_balance, _new_balance, 'Gold txn: Zeebo Capitaux Limited', 'Zeebo Capitaux Limited');
  _curr_balance := _new_balance;

  -- Transaction for Yewande Zaccheaus
  _new_balance := _curr_balance + 8570;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 8570, 'USD', _curr_balance, _new_balance, 'Gold txn: Yewande Zaccheaus', 'Yewande Zaccheaus');
  _curr_balance := _new_balance;

  -- Transaction for Yewande Zaccheaus
  _new_balance := _curr_balance + 33175;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 33175, 'USD', _curr_balance, _new_balance, 'Gold txn: Yewande Zaccheaus', 'Yewande Zaccheaus');
  _curr_balance := _new_balance;

  -- Transaction for Tolulope Susanna Amsata-Awani
  _new_balance := _curr_balance + 14980;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 14980, 'USD', _curr_balance, _new_balance, 'Gold txn: Tolulope Susanna Amsata-Awani', 'Tolulope Susanna Amsata-Awani');
  _curr_balance := _new_balance;

  -- Transaction for Leona Adesanya and Asa Asika
  _new_balance := _curr_balance + 7376;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 7376, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Adesanya and Asa Asika', 'Leona Adesanya and Asa Asika');
  _curr_balance := _new_balance;

  -- Transaction for Leona Adesanya and Asa Asika
  _new_balance := _curr_balance + 1717.59;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'credit', 1717.59, 'USD', _curr_balance, _new_balance, 'Gold txn: Leona Adesanya and Asa Asika', 'Leona Adesanya and Asa Asika');
  _curr_balance := _new_balance;

  -- Transaction for Belinda Disu
  _new_balance := _curr_balance - 92175.41;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'debit', 92175.41, 'USD', _curr_balance, _new_balance, 'Gold txn: Belinda Disu', 'Belinda Disu');
  _curr_balance := _new_balance;

  -- Transaction for Bimbo Oguntunde
  _new_balance := _curr_balance - 3835.98;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'debit', 3835.98, 'USD', _curr_balance, _new_balance, 'Gold txn: Bimbo Oguntunde', 'Bimbo Oguntunde');
  _curr_balance := _new_balance;

  -- Transaction for Christopher Ibru
  _new_balance := _curr_balance - 5445.84;
  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)
  VALUES (_account_id, _user_id, 'debit', 5445.84, 'USD', _curr_balance, _new_balance, 'Gold txn: Christopher Ibru', 'Christopher Ibru');
  _curr_balance := _new_balance;

  UPDATE public.accounts SET balance = _curr_balance WHERE id = _account_id;
END $$;
