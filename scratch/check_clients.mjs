import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wpdxjcbdzrwfcvfbrxst.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_CSmMRz_vOV-fDD8MP5P-9g_exYNa60u"; // fallback to public if needed

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('clients').select('id, name');
  console.log("Clients in DB:", data);
  const { data: accounts, error: err2 } = await supabase.from('accounts').select('id, name, user_id, client_id');
  console.log("Accounts in DB:", accounts);
}
check();
