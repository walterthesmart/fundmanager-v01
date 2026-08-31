import pandas as pd
import json

file_path = "Gold Fund Model 2026.xlsx"
xl = pd.ExcelFile(file_path)
print("Sheet names:", xl.sheet_names)

for sheet_name in xl.sheet_names:
    print(f"\n--- Sheet: {sheet_name} ---")
    df = xl.parse(sheet_name)
    print(df.head(10).to_json(orient='records'))
