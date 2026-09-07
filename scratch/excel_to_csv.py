import pandas as pd

file_path = r"c:\Users\nwaug\Desktop\fundmanager-v01\Trade Tracker 2022-YTD V2 (2).xlsx"
try:
    df = pd.read_excel(file_path, sheet_name="Sheet5")
    df.to_csv(r"c:\Users\nwaug\Desktop\fundmanager-v01\USD GIF Trans.csv", index=False)
    print("CSV created successfully.")
except Exception as e:
    print(e)
