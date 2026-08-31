# from quickbooks import QuickBooks
# from quickbooks.objects.customer import Customer

# # Assume you have already obtained 'access_token', 'refresh_token', and 'realm_id'
# client = QuickBooks(
#     sandbox=False, # Set to False for production
#     consumer_key='ABjr3gf21IlUH3WaMGJuRcRcmNRi8jDSG6IiDEVjjEE3o6XJlX',
#     consumer_secret='R1SOyHDRDab2BAoYwzVuhNLKUTO5n9576P4hjsy2',
#     access_token='eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwieC5vcmciOiJIMCJ9..qxbmG1F20HZiF0NES8NDMg.IYQZ8Td33Cfj8HSa7S3eFiafwR8-9nC9a4Zc-bPEA2WWOgvaTEoNmOcHkiz5G-z2l2-r3dJ2NepXUYOY3MWcg7v9CLRfvbcw1X9sKFacCIObp0eyMKLAiQ9AnFGpZ9nV5kM6xpxWFpPhY_HPB6Dws810DObne77YWQhc45_Tlic9P_7f8rnC7yOrr8ZS_jTJi1X_4TucOc52vIaACX8JluBuhBDDBzLkFff_3u-5kb20EIzpzAlPHiLi8woMS-gVk5Wo-xpQpY0xLY9I_nyGeKNDUQA9DSikz3_6h1Bhw3nWh_qP3IbOMtFKhwqzJlw6dqY87x9Kw1fuWD48JNBiCLfxDDOsWB8yyJMs4Cm-Obr3oyugPk6CV5cSRsEL1Cr9-8c-pqGKaiAlo_IoCyfSCW8R18GC8TalYU5j-4gPe4n9xJ7BVlIxwwadQHCeQgNmNzlW8IeuWjWV7THg7IY2xO_3AnLOCCqub0GqUtiHppA.GLpHFh0MAYFeqEjUOJoRYw',
#     refresh_token='RT1-40-H0-178966113376jdttnhfsgnrkctqhzx',
#     company_id='9341452376501884'
# )

# # Fetch all customers
# customers = Customer.all(qb=client)
# for customer in customers:
#     print(f"Customer ID: {customer.Id}, Name: {customer.DisplayName}")


from quickbooks import QuickBooks
from quickbooks.objects.customer import Customer
from quickbooks.objects.vendor import Vendor
from quickbooks.objects.invoice import Invoice
from quickbooks.objects.bill import Bill
from quickbooks.objects.payment import Payment
from quickbooks.objects.account import Account
from quickbooks.objects.item import Item
from quickbooks.objects.employee import Employee
from quickbooks.objects.estimate import Estimate
from quickbooks.objects.purchaseorder import PurchaseOrder
from quickbooks.objects.deposit import Deposit
from quickbooks.objects.transfer import Transfer
from quickbooks.objects.journalentry import JournalEntry
from quickbooks.objects.taxrate import TaxRate
from quickbooks.objects.taxcode import TaxCode
from intuitlib.client import AuthClient
import json
import os
from dotenv import load_dotenv

load_dotenv()

client_id = os.environ.get('QB_CLIENT_ID')
client_secret = os.environ.get('QB_CLIENT_SECRET')
access_token = '' # we'll get this via refresh
refresh_token = os.environ.get('refresh_token')
realm_id = os.environ.get('realm_id')

# Step 1: Create auth_client FIRST
auth_client = AuthClient(
    client_id=client_id,
    client_secret=client_secret,
    environment='sandbox',
    redirect_uri='https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
)

# Step 2: Set tokens
auth_client.access_token = access_token
auth_client.refresh_token = refresh_token
auth_client.realm_id = realm_id

# Step 3: Refresh the token
try:
    auth_client.refresh(refresh_token=refresh_token)
    print("Token refreshed successfully")
except Exception as e:
    print(f"Token refresh failed: {e}")
    print("Proceeding with existing token...")

# Step 4: Create QuickBooks client
client = QuickBooks(
    auth_client=auth_client,
    company_id=realm_id,
    sandbox=True
)

def fetch(label, cls):
    try:
        results = cls.all(qb=client)
        print(f"\n{'='*60}")
        print(f"{label} ({len(results)} records)")
        print('='*60)
        for obj in results:
            print(json.dumps(obj.to_dict(), indent=2, default=str))
        return results
    except Exception as e:
        print(f"\n[SKIPPED] {label}: {e}")
        return []

fetch("CUSTOMERS", Customer)
fetch("VENDORS", Vendor)
fetch("INVOICES", Invoice)
fetch("BILLS", Bill)
fetch("PAYMENTS", Payment)
fetch("ACCOUNTS", Account)
fetch("ITEMS / PRODUCTS", Item)
fetch("EMPLOYEES", Employee)
fetch("ESTIMATES", Estimate)
fetch("PURCHASE ORDERS", PurchaseOrder)
fetch("DEPOSITS", Deposit)
fetch("TRANSFERS", Transfer)
fetch("JOURNAL ENTRIES", JournalEntry)
fetch("TAX RATES", TaxRate)
fetch("TAX CODES", TaxCode)