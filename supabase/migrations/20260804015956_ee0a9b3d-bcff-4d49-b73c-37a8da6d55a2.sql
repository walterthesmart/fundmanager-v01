REVOKE ALL ON FUNCTION public.post_transaction(uuid, public.txn_type, numeric, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_account_details(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_transaction(uuid, public.txn_type, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_account_details(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_txn_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;