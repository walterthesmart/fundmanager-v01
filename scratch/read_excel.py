import pandas as pd
import json

file_path = r"c:\Users\nwaug\Desktop\fundmanager-v01\GIF($).xlsx"
try:
    df = pd.read_excel(file_path)
    # Convert dates to strings for JSON serialization
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].astype(str)
    
    print("Columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head(5).to_json(orient="records", indent=2, date_format='iso'))
except Exception as e:
    print(e)
