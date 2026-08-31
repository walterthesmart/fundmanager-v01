# import requests
# import json

# access_token='eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwieC5vcmciOiJIMCJ9..qxbmG1F20HZiF0NES8NDMg.IYQZ8Td33Cfj8HSa7S3eFiafwR8-9nC9a4Zc-bPEA2WWOgvaTEoNmOcHkiz5G-z2l2-r3dJ2NepXUYOY3MWcg7v9CLRfvbcw1X9sKFacCIObp0eyMKLAiQ9AnFGpZ9nV5kM6xpxWFpPhY_HPB6Dws810DObne77YWQhc45_Tlic9P_7f8rnC7yOrr8ZS_jTJi1X_4TucOc52vIaACX8JluBuhBDDBzLkFff_3u-5kb20EIzpzAlPHiLi8woMS-gVk5Wo-xpQpY0xLY9I_nyGeKNDUQA9DSikz3_6h1Bhw3nWh_qP3IbOMtFKhwqzJlw6dqY87x9Kw1fuWD48JNBiCLfxDDOsWB8yyJMs4Cm-Obr3oyugPk6CV5cSRsEL1Cr9-8c-pqGKaiAlo_IoCyfSCW8R18GC8TalYU5j-4gPe4n9xJ7BVlIxwwadQHCeQgNmNzlW8IeuWjWV7THg7IY2xO_3AnLOCCqub0GqUtiHppA.GLpHFh0MAYFeqEjUOJoRYw'
# realm_id='9341452376501884'

# url = f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/query"

# headers = {
#     'Authorization': f'Bearer {access_token}',
#     'Accept': 'application/json',
#     'Content-Type': 'application/text'
# }

# entities = [
#     "Account", "Attachable", "Bill", "BillPayment", "Budget",
#     "Class", "CreditMemo", "Customer", "Department", "Deposit",
#     "Employee", "Estimate", "ExchangeRate", "Invoice", "Item",
#     "JournalEntry", "Payment", "PaymentMethod", "Preferences",
#     "Purchase", "PurchaseOrder", "RefundReceipt", "SalesReceipt",
#     "TaxAgency", "TaxCode", "TaxRate", "TaxService", "Term",
#     "TimeActivity", "Transfer", "Vendor", "VendorCredit"
# ]

# print("Testing available entities...\n")
# available = []
# unavailable = []

# for entity in entities:
#     q = f"SELECT * FROM {entity} MAXRESULTS 1"
#     response = requests.post(url, headers=headers, data=q, params={'minorversion': 65})
    
#     if response.status_code == 200:
#         data = response.json()
#         query_response = data.get('QueryResponse', {})
#         total = query_response.get('totalCount', 'unknown count')
#         available.append(entity)
#         print(f"[OK]   {entity:30s} -- {total} records")
#     else:
#         error = response.json().get('Fault', {}).get('Error', [{}])[0].get('Message', 'unknown error')
#         unavailable.append(entity)
#         print(f"[FAIL] {entity:30s} -- {error}")

# print(f"\n\nSUMMARY")
# print(f"Available ({len(available)}): {', '.join(available)}")
# print(f"Unavailable ({len(unavailable)}): {', '.join(unavailable)}")





# import requests
# import json
# from intuitlib.client import AuthClient
# from datetime import datetime

# # ── Credentials ───────────────────────────────────────────────────────────────
# client_id     = 'ABjr3gf21IlUH3WaMGJuRcRcmNRi8jDSG6IiDEVjjEE3o6XJlX'
# client_secret = 'R1SOyHDRDab2BAoYwzVuhNLKUTO5n9576P4hjsy2'
# refresh_token = 'RT1-40-H0-178966113376jdttnhfsgnrkctqhzx'
# realm_id      = '9341452376501884'

# # ── Auth: auto-refresh token ──────────────────────────────────────────────────
# auth_client = AuthClient(
#     client_id=client_id,
#     client_secret=client_secret,
#     environment='production',
#     redirect_uri='https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
# )
# auth_client.refresh_token = refresh_token
# auth_client.realm_id      = realm_id

# try:
#     auth_client.refresh(refresh_token=refresh_token)
#     access_token = auth_client.access_token
#     print("Token refreshed OK\n")
# except Exception as e:
#     print(f"Token refresh failed: {e}")
#     exit(1)

# # ── Base config ───────────────────────────────────────────────────────────────
# BASE   = f"https://quickbooks.api.intuit.com/v3/company/{realm_id}"
# MV     = {'minorversion': 75}

# QUERY_HEADERS = {
#     'Authorization': f'Bearer {access_token}',
#     'Accept':        'application/json',
#     'Content-Type':  'application/text',
# }
# JSON_HEADERS = {
#     'Authorization': f'Bearer {access_token}',
#     'Accept':        'application/json',
#     'Content-Type':  'application/json',
# }

# # ── Helpers ───────────────────────────────────────────────────────────────────
# def divider(title):
#     print(f"\n\n{'=' * 70}")
#     print(f"  {title}")
#     print(f"{'=' * 70}")

# def print_json(data):
#     print(json.dumps(data, indent=2, default=str))

# def fetch_entity(entity, max_results=1000):
#     """Fetch all records for a queryable entity."""
#     q = f"SELECT * FROM {entity} MAXRESULTS {max_results}"
#     r = requests.post(f"{BASE}/query", headers=QUERY_HEADERS, data=q, params=MV)
#     if r.status_code == 200:
#         qr      = r.json().get('QueryResponse', {})
#         records = qr.get(entity, [])
#         total   = qr.get('totalCount', len(records))
#         return True, total, records
#     else:
#         fault = r.json().get('Fault', {}).get('Error', [{}])[0]
#         return False, 0, fault.get('Message', 'Unknown error')

# def fetch_report(report_name, params={}):
#     """Fetch a financial report."""
#     p = {**MV, **params}
#     r = requests.get(f"{BASE}/reports/{report_name}", headers=JSON_HEADERS, params=p)
#     if r.status_code == 200:
#         return True, r.json()
#     else:
#         fault = r.json().get('Fault', {}).get('Error', [{}])[0]
#         return False, fault.get('Message', 'Unknown error')

# def fetch_url(path, params={}):
#     """Fetch any REST endpoint by path."""
#     p = {**MV, **params}
#     r = requests.get(f"{BASE}/{path}", headers=JSON_HEADERS, params=p)
#     if r.status_code == 200:
#         return True, r.json()
#     else:
#         fault = r.json().get('Fault', {}).get('Error', [{}])[0]
#         return False, fault.get('Message', 'Unknown error')

# # ── Date ranges ───────────────────────────────────────────────────────────────
# TODAY      = datetime.today().strftime('%Y-%m-%d')
# THIS_YEAR  = datetime.today().year
# LAST_YEAR  = THIS_YEAR - 1

# RANGE_THIS_YEAR = {'start_date': f'{THIS_YEAR}-01-01', 'end_date': TODAY}
# RANGE_LAST_YEAR = {'start_date': f'{LAST_YEAR}-01-01', 'end_date': f'{LAST_YEAR}-12-31'}
# RANGE_MAY_2026  = {'start_date': '2026-05-01',         'end_date': '2026-05-31'}
# RANGE_YTD_2026  = {'start_date': '2026-01-01',         'end_date': '2026-05-31'}

# # =============================================================================
# # SECTION 1: ENTITIES
# # =============================================================================
# divider("SECTION 1: ENTITIES")

# entities = [
#     "Account",
#     "Attachable",
#     "Bill",
#     "BillPayment",
#     "Budget",
#     "Class",
#     "CreditMemo",
#     "Customer",
#     "Department",
#     "Deposit",
#     "Employee",
#     "Estimate",
#     "ExchangeRate",
#     "Invoice",
#     "Item",
#     "JournalEntry",
#     "Payment",
#     "PaymentMethod",
#     "Preferences",
#     "Purchase",
#     "PurchaseOrder",
#     "RefundReceipt",
#     "SalesReceipt",
#     "TaxAgency",
#     "TaxCode",
#     "TaxRate",
#     "TaxService",
#     "Term",
#     "TimeActivity",
#     "Transfer",
#     "Vendor",
#     "VendorCredit",
# ]

# entity_summary = {'ok': [], 'fail': []}

# for entity in entities:
#     ok, total, data = fetch_entity(entity)
#     if ok:
#         entity_summary['ok'].append((entity, total))
#         print(f"\n[OK] {entity} -- {total} records")
#         print_json(data)
#     else:
#         entity_summary['fail'].append((entity, data))
#         print(f"[FAIL] {entity:30s} -- {data}")

# # =============================================================================
# # SECTION 2: FINANCIAL REPORTS (current year + last year + specific periods)
# # =============================================================================
# divider("SECTION 2: FINANCIAL REPORTS")

# reports = [
#     # ── P&L ──────────────────────────────────────────────────────────────────
#     ("ProfitAndLoss",               {**RANGE_THIS_YEAR, 'accounting_method': 'Accrual', 'showrows': 'all', 'showcols': 'all'}),
#     ("ProfitAndLoss",               {**RANGE_LAST_YEAR, 'accounting_method': 'Accrual', 'showrows': 'all', 'showcols': 'all'}),
#     ("ProfitAndLossDetail",         {**RANGE_THIS_YEAR, 'accounting_method': 'Accrual'}),
#     ("ProfitAndLossDetail",         {**RANGE_LAST_YEAR, 'accounting_method': 'Accrual'}),

#     # ── Specific periods (for your Actual vs Budget report) ───────────────────
#     ("ProfitAndLoss",               {**RANGE_MAY_2026,  'accounting_method': 'Accrual', 'showrows': 'all'}),
#     ("ProfitAndLossDetail",         {**RANGE_MAY_2026,  'accounting_method': 'Accrual'}),
#     ("ProfitAndLoss",               {**RANGE_YTD_2026,  'accounting_method': 'Accrual', 'showrows': 'all'}),
#     ("ProfitAndLossDetail",         {**RANGE_YTD_2026,  'accounting_method': 'Accrual'}),

#     # ── Balance Sheet ─────────────────────────────────────────────────────────
#     ("BalanceSheet",                {**RANGE_THIS_YEAR, 'accounting_method': 'Accrual', 'showrows': 'all'}),
#     ("BalanceSheet",                {**RANGE_LAST_YEAR, 'accounting_method': 'Accrual', 'showrows': 'all'}),
#     ("BalanceSheetDetail",          {**RANGE_THIS_YEAR, 'accounting_method': 'Accrual'}),

#     # ── Cash Flow ─────────────────────────────────────────────────────────────
#     ("CashFlow",                    {**RANGE_THIS_YEAR}),
#     ("CashFlow",                    {**RANGE_LAST_YEAR}),

#     # ── General Ledger ────────────────────────────────────────────────────────
#     ("GeneralLedger",               {**RANGE_THIS_YEAR, 'accounting_method': 'Accrual'}),
#     ("GeneralLedger",               {**RANGE_LAST_YEAR, 'accounting_method': 'Accrual'}),

#     # ── Trial Balance ─────────────────────────────────────────────────────────
#     ("TrialBalance",                {**RANGE_THIS_YEAR}),
#     ("TrialBalance",                {**RANGE_LAST_YEAR}),

#     # ── Journal ───────────────────────────────────────────────────────────────
#     ("JournalReport",               {**RANGE_THIS_YEAR}),

#     # ── Transactions ──────────────────────────────────────────────────────────
#     ("TransactionList",             {**RANGE_THIS_YEAR}),
#     ("TransactionList",             {**RANGE_LAST_YEAR}),
#     ("TransactionListByCustomer",   {**RANGE_THIS_YEAR}),
#     ("TransactionListByVendor",     {**RANGE_THIS_YEAR}),
#     ("TransactionListWithSplits",   {**RANGE_THIS_YEAR}),

#     # ── Receivables & Payables ────────────────────────────────────────────────
#     ("AgedReceivables",             {'report_date': TODAY, 'agingperiod': 30, 'agingmethod': 'ReportDate'}),
#     ("AgedPayables",                {'report_date': TODAY, 'agingperiod': 30, 'agingmethod': 'ReportDate'}),

#     # ── Customer reports ──────────────────────────────────────────────────────
#     ("CustomerBalance",             {'report_date': TODAY}),
#     ("CustomerBalanceDetail",       {'report_date': TODAY}),
#     ("CustomerIncome",              {**RANGE_THIS_YEAR}),

#     # ── Vendor reports ────────────────────────────────────────────────────────
#     ("VendorBalance",               {'report_date': TODAY}),
#     ("VendorBalanceDetail",         {'report_date': TODAY}),
#     ("VendorExpenses",              {**RANGE_THIS_YEAR}),

#     # ── Sales reports ─────────────────────────────────────────────────────────
#     ("SalesByCustomer",             {**RANGE_THIS_YEAR}),
#     ("SalesByCustomer",             {**RANGE_LAST_YEAR}),
#     ("SalesByProduct",              {**RANGE_THIS_YEAR}),
#     ("SalesByDepartment",           {**RANGE_THIS_YEAR}),
#     ("SalesByClassSummary",         {**RANGE_THIS_YEAR}),

#     # ── Inventory ─────────────────────────────────────────────────────────────
#     ("InventoryValuationSummary",   {'report_date': TODAY}),
#     ("InventoryValuationDetail",    {'report_date': TODAY}),

#     # ── Tax ───────────────────────────────────────────────────────────────────
#     ("TaxSummary",                  {**RANGE_THIS_YEAR}),
# ]

# report_summary = {'ok': [], 'fail': []}

# for report_name, params in reports:
#     label = f"{report_name} ({params.get('start_date', params.get('report_date', 'snapshot'))} to {params.get('end_date', '')})"
#     ok, data = fetch_report(report_name, params)
#     if ok:
#         report_summary['ok'].append(label)
#         print(f"\n[OK] REPORT: {label}")
#         print_json(data)
#     else:
#         report_summary['fail'].append((label, data))
#         print(f"[FAIL] REPORT: {label} -- {data}")

# # =============================================================================
# # SECTION 3: COMPANY INFO, PREFERENCES & SETTINGS
# # =============================================================================
# divider("SECTION 3: COMPANY INFO & PREFERENCES")

# misc_endpoints = [
#     (f"companyinfo/{realm_id}", "Company Info",   {}),
#     ("preferences",             "Preferences",    {}),
# ]

# for path, label, params in misc_endpoints:
#     ok, data = fetch_url(path, params)
#     if ok:
#         print(f"\n[OK] {label}")
#         print_json(data)
#     else:
#         print(f"[FAIL] {label} -- {data}")

# # =============================================================================
# # SUMMARY
# # =============================================================================
# divider("SUMMARY")

# print(f"\nENTITIES")
# print(f"  OK   ({len(entity_summary['ok'])}): {', '.join(e for e, _ in entity_summary['ok'])}")
# print(f"  FAIL ({len(entity_summary['fail'])}): {', '.join(e for e, _ in entity_summary['fail'])}")

# print(f"\nREPORTS")
# print(f"  OK   ({len(report_summary['ok'])}): {chr(10) + '    - ' + (chr(10) + '    - ').join(report_summary['ok'])}")
# print(f"  FAIL ({len(report_summary['fail'])}):")
# for label, err in report_summary['fail']:
#     print(f"    - {label}: {err}")

# print(f"\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")





import requests
import json
from intuitlib.client import AuthClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# ── Credentials ───────────────────────────────────────────────────────────────
client_id     = os.environ.get('QB_CLIENT_ID')
client_secret = os.environ.get('QB_CLIENT_SECRET')
refresh_token = os.environ.get('refresh_token')
realm_id      = os.environ.get('realm_id')

# ── Auth ──────────────────────────────────────────────────────────────────────
auth_client = AuthClient(
    client_id=client_id,
    client_secret=client_secret,
    environment='sandbox',
    redirect_uri='https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
)
auth_client.refresh_token = refresh_token
auth_client.realm_id      = realm_id

try:
    auth_client.refresh(refresh_token=refresh_token)
    access_token = auth_client.access_token
    print("Token refreshed OK\n")
except Exception as e:
    print(f"Token refresh failed: {e}")
    exit(1)

BASE = f"https://sandbox-quickbooks.api.intuit.com/v3/company/{realm_id}"
MV   = {'minorversion': 75}

QUERY_HEADERS = {
    'Authorization': f'Bearer {access_token}',
    'Accept':        'application/json',
    'Content-Type':  'application/text',
}
JSON_HEADERS = {
    'Authorization': f'Bearer {access_token}',
    'Accept':        'application/json',
    'Content-Type':  'application/json',
}

TODAY     = datetime.today().strftime('%Y-%m-%d')
THIS_YEAR = datetime.today().year
LAST_YEAR = THIS_YEAR - 1

def divider(title):
    print(f"\n\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")

def print_json(data):
    print(json.dumps(data, indent=2, default=str))

def fetch_report(name, params):
    p = {**MV, **params}
    r = requests.get(f"{BASE}/reports/{name}", headers=JSON_HEADERS, params=p)
    if r.status_code == 200:
        return True, r.json()
    fault = r.json().get('Fault', {}).get('Error', [{}])[0]
    return False, fault.get('Message', 'Unknown error')

def fetch_entity(entity, max_results=1000):
    q = f"SELECT * FROM {entity} MAXRESULTS {max_results}"
    r = requests.post(f"{BASE}/query", headers=QUERY_HEADERS, data=q, params=MV)
    if r.status_code == 200:
        qr      = r.json().get('QueryResponse', {})
        records = qr.get(entity, [])
        total   = qr.get('totalCount', len(records))
        return True, total, records
    fault = r.json().get('Fault', {}).get('Error', [{}])[0]
    return False, 0, fault.get('Message', 'Unknown error')

# =============================================================================
# SECTION 1: P&L ACTUALS — the core of your report
# Fetches actual income/expense figures that feed your P&L statement
# =============================================================================
divider("SECTION 1: P&L ACTUALS")

pnl_reports = [
    # May 2026 only (for the monthly column)
    ("ProfitAndLoss", {
        'start_date':        '2026-05-01',
        'end_date':          '2026-05-31',
        'accounting_method': 'Accrual',
        'showrows':          'all',
        'showcols':          'all',
        'adjusted_gain_loss': 'true',   # includes FX/fair value where recorded in QBO
    }),
    # Jan-May 2026 YTD (for the YTD column)
    ("ProfitAndLoss", {
        'start_date':        '2026-01-01',
        'end_date':          '2026-05-31',
        'accounting_method': 'Accrual',
        'showrows':          'all',
        'showcols':          'all',
        'adjusted_gain_loss': 'true',
    }),
    # Monthly breakdown Jan-May 2026 — one column per month, useful for trends
    ("ProfitAndLoss", {
        'start_date':           '2026-01-01',
        'end_date':             '2026-05-31',
        'accounting_method':    'Accrual',
        'summarize_column_by':  'Month',
        'showrows':             'all',
        'adjusted_gain_loss':   'true',
    }),
    # Full year 2025 for comparison / Budget 2025 column reference
    ("ProfitAndLoss", {
        'start_date':        '2025-01-01',
        'end_date':          '2025-12-31',
        'accounting_method': 'Accrual',
        'showrows':          'all',
        'showcols':          'all',
        'adjusted_gain_loss': 'true',
    }),
]

for name, params in pnl_reports:
    label = f"ProfitAndLoss {params.get('start_date')} to {params.get('end_date')} [{params.get('summarize_column_by','Total')}]"
    ok, data = fetch_report(name, params)
    if ok:
        print(f"\n[OK] {label}")
        print_json(data)
    else:
        print(f"[FAIL] {label} -- {data}")

# =============================================================================
# SECTION 2: P&L DETAIL — transaction-level breakdown
# Gives you every individual transaction behind each P&L line
# Fetched month by month to avoid 504 timeouts on large datasets
# =============================================================================
divider("SECTION 2: P&L DETAIL (month by month)")

months_2026 = [
    ('2026-01-01', '2026-01-31'),
    ('2026-02-01', '2026-02-28'),
    ('2026-03-01', '2026-03-31'),
    ('2026-04-01', '2026-04-30'),
    ('2026-05-01', '2026-05-31'),
]

for start, end in months_2026:
    ok, data = fetch_report("ProfitAndLossDetail", {
        'start_date':        start,
        'end_date':          end,
        'accounting_method': 'Accrual',
        'adjusted_gain_loss': 'true',
    })
    if ok:
        print(f"\n[OK] ProfitAndLossDetail {start} to {end}")
        print_json(data)
    else:
        print(f"[FAIL] ProfitAndLossDetail {start} to {end} -- {data}")

# =============================================================================
# SECTION 3: TRIAL BALANCE
# Matches the document you shared — every account with debit/credit balance
# =============================================================================
divider("SECTION 3: TRIAL BALANCE")

trial_balance_dates = [
    ('2026-05-01', '2026-05-31'),   # end of May 2026
    ('2026-01-01', '2026-05-31'),   # YTD May 2026
    ('2025-09-01', '2025-09-30'),   # matches your shared document (Sep 2025)
    ('2025-01-01', '2025-12-31'),   # full year 2025
]

for start, end in trial_balance_dates:
    ok, data = fetch_report("TrialBalance", {
        'start_date':        start,
        'end_date':          end,
        'accounting_method': 'Accrual',
    })
    if ok:
        print(f"\n[OK] TrialBalance {start} to {end}")
        print_json(data)
    else:
        print(f"[FAIL] TrialBalance {start} to {end} -- {data}")

# =============================================================================
# SECTION 4: BUDGET DATA
# Pulls any budgets entered in QuickBooks — these are the "Budget" columns
# in your report. Only works if budgets were set up in QBO.
# =============================================================================
divider("SECTION 4: BUDGET DATA")

ok, total, budgets = fetch_entity("Budget")
if ok:
    print(f"\n[OK] Budget -- {total} records")
    print_json(budgets)
else:
    print(f"[FAIL] Budget -- {budgets}")
    print("  --> Budgets may not be set up in QuickBooks, or your plan doesn't support it.")
    print("  --> Budget figures in your report likely live in a separate Excel/Google Sheet.")

# =============================================================================
# SECTION 5: GENERAL LEDGER
# Full transaction history by account — useful for verifying P&L line totals
# and tracing specific entries like FX gains/losses if they were journalled in
# =============================================================================
divider("SECTION 5: GENERAL LEDGER")

gl_periods = [
    ('2026-05-01', '2026-05-31'),
    ('2026-01-01', '2026-05-31'),
]

for start, end in gl_periods:
    ok, data = fetch_report("GeneralLedger", {
        'start_date':        start,
        'end_date':          end,
        'accounting_method': 'Accrual',
    })
    if ok:
        print(f"\n[OK] GeneralLedger {start} to {end}")
        print_json(data)
    else:
        print(f"[FAIL] GeneralLedger {start} to {end} -- {data}")

# =============================================================================
# SECTION 6: JOURNAL ENTRIES
# If FX gains/losses, fair value adjustments, or trading income are recorded
# as manual journal entries in QBO, this is where they live
# =============================================================================
divider("SECTION 6: JOURNAL ENTRIES (manual adjustments)")

ok, total, journals = fetch_entity("JournalEntry")
if ok:
    print(f"\n[OK] JournalEntry -- {total} records")
    print_json(journals)
else:
    print(f"[FAIL] JournalEntry -- {journals}")

# Also fetch journal report for the period
ok, data = fetch_report("JournalReport", {
    'start_date': '2026-01-01',
    'end_date':   '2026-05-31',
})
if ok:
    print(f"\n[OK] JournalReport Jan-May 2026")
    print_json(data)
else:
    print(f"[FAIL] JournalReport -- {data}")

# =============================================================================
# SECTION 7: ACCOUNTS (Chart of Accounts)
# Shows how your accounts are structured — helps map QBO account names
# to the line items in your P&L report
# =============================================================================
divider("SECTION 7: CHART OF ACCOUNTS")

ok, total, accounts = fetch_entity("Account")
if ok:
    print(f"\n[OK] Account -- {total} records")
    # Print a simplified mapping: name -> type -> subtype
    print("\nAccount mapping (Name | Type | SubType):")
    for a in accounts:
        print(f"  {a.get('FullyQualifiedName',''):<60} | {a.get('AccountType',''):<25} | {a.get('AccountSubType','')}")
else:
    print(f"[FAIL] Account -- {accounts}")

# =============================================================================
# SECTION 8: PREFERENCES
# Check accounting method setting and fiscal year — affects all report numbers
# =============================================================================
divider("SECTION 8: COMPANY PREFERENCES")

r = requests.get(f"{BASE}/preferences", headers=JSON_HEADERS, params=MV)
if r.status_code == 200:
    prefs = r.json()
    print_json(prefs)
    # Extract the key settings
    acc_prefs = prefs.get('Preferences', {}).get('AccountingInfoPrefs', {})
    print(f"\nKey settings:")
    print(f"  Accounting method: {acc_prefs.get('BookCloseDate', 'unknown')}")
    print(f"  First month of fiscal year: {acc_prefs.get('FirstMonthOfFiscalYear', 'unknown')}")
    print(f"  Tax year month: {acc_prefs.get('TaxYearMonth', 'unknown')}")
else:
    print(f"[FAIL] Preferences")

print(f"\n\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("""
=============================================================================
NOTES ON WHAT'S NOT IN QUICKBOOKS:
=============================================================================
The following lines in your P&L likely do NOT live in QuickBooks and will
need to be sourced separately:

1. Fair Value Gain/Loss - FVTPL
   --> Comes from portfolio valuation system or manual calculation

2. Fair Value Gain/Loss on Quoted Equities
   --> Comes from market data / equity pricing system

3. Unrealised Foreign Exchange Gain/Loss
   --> Comes from FX revaluation model (e.g. Excel/Bloomberg)

4. Realised Foreign Exchange Gain/Loss
   --> May be in QBO as journal entries — check SECTION 6 above

5. Income from Trading Activities
   --> Likely from a separate trading/brokerage system

6. Budget columns
   --> Check SECTION 4. If empty, budgets live in Excel/Google Sheets

To build the full Actual vs Budget report automatically, you would need to:
- Pull actuals from QuickBooks (this script)
- Pull budget figures from wherever they're stored
- Compute variance = actual - budget
- Compute variance % = variance / abs(budget) * 100
=============================================================================
""")