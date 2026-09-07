function pullHistoricalBondsFromGmailFBNUK() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FBNUK");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("FBNUK");
  }
  
  // Search Gmail for the exact subject line (grabs the last 20 email threads)
  const threads = GmailApp.search('subject:"FIRSTBANK: African Eurobonds & US Treasuries"', 0, 20);
  
  if (threads.length === 0) {
    SpreadsheetApp.getUi().alert("No emails found with that subject.");
    return;
  }
  
  const flatData = [];
  
  // 1. Loop through all the emails and extract flat data
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const message = messages[j];
      const date = message.getDate();
      const body = message.getBody();
      
      // Format the email date nicely (e.g., "2024-10-25")
      const dateString = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
      
      // Regular expressions to find table rows and cells
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      
      let rowMatch;
      while ((rowMatch = rowRegex.exec(body)) !== null) {
        const rowHtml = rowMatch[1];
        const cells = [];
        let cellMatch;
        
        // Extract text from each cell
        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          let cellText = cellMatch[1].replace(/<[^>]+>/g, '').trim(); // Remove HTML tags
          cellText = cellText.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'); // Clean entities
          cells.push(cellText);
        }
        
        // Ensure the row has data and isn't the header row.
        // Filter out headers by checking that the price column isn't "Bid Px"
        if (cells.length >= 4 && cells[0] !== "" && cells[1] !== "Bid Px") {
          flatData.push({
            date: dateString,
            symbol: cells[0],      // e.g., "REPUBLIC OF NIGERIA NOV 2027"
            price: cells[1]        // e.g., Bid Px
          });
        }
      }
    }
  }
  
  if (flatData.length === 0) {
    SpreadsheetApp.getUi().alert("No bond data could be extracted from the emails.");
    return;
  }
  
  // 2. Pivot the Data (Dates as Rows, Symbols as Columns)
  
  // Get unique, sorted dates and unique symbols
  const uniqueDates = [...new Set(flatData.map(d => d.date))].sort((a, b) => new Date(a) - new Date(b));
  const uniqueSymbols = [...new Set(flatData.map(d => d.symbol))];
  
  const output = [];
  
  // Row 1: DS002 headers
  const row1 = ["DS002", "", ""];
  uniqueSymbols.forEach(() => row1.push(""));
  output.push(row1);
  
  // Row 2: PR002 headers (Issuer placeholders)
  const row2 = ["PR002", "", ""];
  uniqueSymbols.forEach(() => row2.push("")); 
  output.push(row2);
  
  // Row 3: Date & ID placeholders
  const row3 = [uniqueDates[0] || "", "", ""];
  uniqueSymbols.forEach(() => row3.push("")); 
  output.push(row3);
  
  // Row 4: Symbols / Descriptions
  const row4 = [uniqueDates[uniqueDates.length - 1] || "", "", "FX"];
  uniqueSymbols.forEach(symbol => row4.push(symbol));
  output.push(row4);
  
  // 3. Build Data Rows
  uniqueDates.forEach(date => {
    // Column A is blank for data rows, Col B is the Date, Col C is a placeholder for FX
    const row = ["", date, ""]; 
    
    uniqueSymbols.forEach(symbol => {
      // Find the specific price for this date and bond symbol
      const dataPoint = flatData.find(d => d.date === date && d.symbol === symbol);
      
      // If found, push the price. If not, push "#N/A N/A" to match your Sheet2 design
      row.push(dataPoint ? dataPoint.price : "#N/A N/A"); 
    });
    
    output.push(row);
  });
  
  // 4. Write the pivoted data to the active sheet
  sheet.clear();
  sheet.getRange(1, 1, output.length, output[0].length).setValues(output);
}