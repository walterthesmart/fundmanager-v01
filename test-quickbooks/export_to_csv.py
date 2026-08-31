import os
import csv
import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

# 1. Load Environment Variables
load_dotenv()
client_id = os.environ.get('QB_CLIENT_ID')
client_secret = os.environ.get('QB_CLIENT_SECRET')
refresh_token = os.environ.get('refresh_token')
realm_id = os.environ.get('realm_id')

# 2. Authenticate
auth_client = AuthClient(
    client_id=client_id,
    client_secret=client_secret,
    environment='sandbox',
    redirect_uri='https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
)
auth_client.refresh_token = refresh_token
try:
    auth_client.refresh(refresh_token=refresh_token)
    print("Token refreshed successfully!")
except Exception as e:
    print(f"Token refresh failed: {e}")
    exit(1)

# 3. Setup API Request Headers
BASE = f"https://sandbox-quickbooks.api.intuit.com/v3/company/{realm_id}"
MV = {'minorversion': 75}
JSON_HEADERS = {
    'Authorization': f'Bearer {auth_client.access_token}',
    'Accept': 'application/json',
}

# 4. Helper Function to Parse QuickBooks Nested Report Rows
def flatten_report_rows(rows_obj, indent=0):
    flat = []
    if not rows_obj or 'Row' not in rows_obj:
        return flat
        
    for row in rows_obj['Row']:
        if row.get('type') == 'Data':
            cols = [col.get('value', '') for col in row.get('ColData', [])]
            if cols: 
                cols[0] = ('    ' * indent) + cols[0]
            flat.append(cols)
        elif row.get('type') == 'Section':
            if 'Header' in row:
                cols = [col.get('value', '') for col in row['Header'].get('ColData', [])]
                if cols: 
                    cols[0] = ('    ' * indent) + cols[0]
                flat.append(cols)
            if 'Rows' in row:
                flat.extend(flatten_report_rows(row['Rows'], indent + 1))
            if 'Summary' in row:
                cols = [col.get('value', '') for col in row['Summary'].get('ColData', [])]
                if cols: 
                    cols[0] = ('    ' * indent) + cols[0]
                flat.append(cols)
    return flat

# 5. Helper Function to Export to CSV
def export_report_to_csv(report_name, params, filename):
    print(f"Exporting {report_name} to {filename}...")
    p = {**MV, **params}
    r = requests.get(f"{BASE}/reports/{report_name}", headers=JSON_HEADERS, params=p)
    
    if r.status_code != 200:
        print(f"  [ERROR] Failed to fetch {report_name}: {r.text}")
        return
        
    data = r.json()
    columns = [col.get('ColTitle', '') for col in data.get('Columns', {}).get('Column', [])]
    rows = flatten_report_rows(data.get('Rows', {}))
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)
    print(f"  [SUCCESS] Saved {len(rows)} rows to {filename}")

# ==========================================
# 6. Run the Exports
# ==========================================
print("\n--- Starting Export ---")

# Export Profit and Loss for Year-to-Date
export_report_to_csv("ProfitAndLoss", {
    'start_date': '2026-01-01',
    'end_date': '2026-12-31',
    'accounting_method': 'Accrual'
}, "ProfitAndLoss_YTD.csv")

# Export Trial Balance
export_report_to_csv("TrialBalance", {
    'start_date': '2026-01-01',
    'end_date': '2026-12-31',
}, "TrialBalance.csv")

# Export Balance Sheet
export_report_to_csv("BalanceSheet", {
    'start_date': '2026-01-01',
    'end_date': '2026-12-31',
}, "BalanceSheet.csv")

# Export Cash Flow
export_report_to_csv("CashFlow", {
    'start_date': '2026-01-01',
    'end_date': '2026-12-31',
}, "CashFlow.csv")

print("--- Export Complete ---\n")
