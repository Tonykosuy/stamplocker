// API Endpoint nhận cả GET và POST
// CHÚ Ý: Google Sheets có giới hạn 50.000 ký tự mỗi ô.
// Ảnh gửi lên (imageBase64) cần được resize nhỏ (khoảng 400px width JPEG 0.5) ở phía Client.

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = JSON.parse(e.postData.contents);
    
    const imageBase64 = data.imageBase64; // Chuỗi base64 đã nén nhỏ
    const caption = data.caption || "";
    const timestamp = data.timestamp;

    // Nếu sheet trống, ghi Header
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "ImageData", "Caption"]);
    }
    
    // Ghi trực tiếp chuỗi Base64 vào cột ImageData (ô B)
    sheet.appendRow([timestamp, imageBase64, caption]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Saved directly to Sheet'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const dataRange = sheet.getDataRange();
    let values = dataRange.getValues();
    
    let records = [];
    
    if (values.length > 1) {
      for (let i = 1; i < values.length; i++) {
        records.push({
          timestamp: values[i][0],
          data: values[i][1], // Đây là chuỗi base64
          caption: values[i][2]
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(records))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
