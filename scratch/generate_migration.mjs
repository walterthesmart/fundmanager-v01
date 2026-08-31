import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as fs from 'fs';

const workbook = readFile('C:/Users/nwaug/Downloads/Gold fund schedule.xlsx');
const sheet = workbook.Sheets['Movement'];
const data = utils.sheet_to_json(sheet, { header: 1 });

let sql = `-- Migration: Setup Gold Fund and populate transactions\n\n`;

// 1. Delete all transactions
sql += `DELETE FROM public.transactions;\n`;
sql += `DELETE FROM public.cash_transactions;\n`;
sql += `UPDATE public.accounts SET balance = 0;\n\n`;

// 2. Insert Sankore Gold Fund
sql += `INSERT INTO public.products (id, name, ticker, asset_class, currency, price_mode, price_source, price)\n`;
sql += `VALUES (gen_random_uuid(), 'Sankore Gold Fund', 'IAU', 'alternatives', 'USD', 'automated', 'yahoo-finance', 0)\n`;
sql += `ON CONFLICT DO NOTHING;\n\n`;

// 3. Insert transactions properly updating balance
sql += `DO $$\n`;
sql += `DECLARE \n  _account_id uuid;\n  _user_id uuid;\n  _curr_balance numeric(18,2) := 0;\n  _new_balance numeric(18,2) := 0;\n`;
sql += `BEGIN\n`;
sql += `  SELECT id, user_id INTO _account_id, _user_id FROM public.accounts LIMIT 1;\n\n`;
sql += `  IF _account_id IS NULL THEN\n`;
sql += `    RETURN;\n`;
sql += `  END IF;\n\n`;

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length === 0 || !row[2]) continue;

  const dateVal = row[1];
  const name = row[2].replace(/'/g, "''");
  const cost = parseFloat(row[3]);
  
  if (isNaN(cost)) continue;

  const type = cost > 0 ? 'credit' : 'debit';
  const absAmount = Math.abs(cost);
  
  sql += `  -- Transaction for ${name}\n`;
  if (type === 'credit') {
    sql += `  _new_balance := _curr_balance + ${absAmount};\n`;
  } else {
    sql += `  _new_balance := _curr_balance - ${absAmount};\n`;
  }
  sql += `  INSERT INTO public.transactions (account_id, user_id, type, amount, currency, balance_before, balance_after, description, counterparty)\n`;
  sql += `  VALUES (_account_id, _user_id, '${type}', ${absAmount}, 'USD', _curr_balance, _new_balance, 'Gold txn: ${name}', '${name}');\n`;
  sql += `  _curr_balance := _new_balance;\n\n`;
}

sql += `  UPDATE public.accounts SET balance = _curr_balance WHERE id = _account_id;\n`;
sql += `END $$;\n`;

fs.writeFileSync('../supabase/migrations/20260831103000_setup_gold_fund.sql', sql);
console.log("Migration generated successfully!");
