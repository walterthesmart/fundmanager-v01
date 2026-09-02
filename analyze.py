import sqlite3

def run():
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    
    cur.execute('SELECT symbol, coupon_rate, maturity_date FROM Instrument')
    instruments = cur.fetchall()
    
    cur.execute('SELECT symbol, direction, value_date, units FROM SecurityTransaction')
    txns = cur.fetchall()
    
    print("=== INSTRUMENTS ===")
    for inst in instruments:
        if "2032" in str(inst[0]):
            print(inst)
            
    print("=== TXNS FGN 2032 ===")
    for tx in txns:
        if "2032" in str(tx[0]):
            print(tx)

    print("=== ALL CLOSED BONDS ===")
    positions = {}
    for tx in txns:
        symbol = str(tx[0]).strip().upper()
        if symbol not in positions:
            positions[symbol] = {'buy': 0, 'sell': 0}
        units = float(tx[3])
        if tx[1] == 'BUY':
            positions[symbol]['buy'] += units
        else:
            positions[symbol]['sell'] += units
            
    for sym, data in positions.items():
        if abs(data['buy'] - data['sell']) < 0.01:
            print(f"{sym}: Closed (Buy {data['buy']}, Sell {data['sell']})")
            
run()
