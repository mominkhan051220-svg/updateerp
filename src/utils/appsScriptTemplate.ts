export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * HishabKhata Pro — Per-Shop Google Sheet Webhook (Apps Script)
 * 1. Open your Shop's Google Sheet -> Extensions -> Apps Script
 * 2. Paste this code and click Deploy -> New deployment -> Web app
 * 3. Execute as: Me | Who has access: Anyone
 * 4. Copy the Web App URL (https://script.google.com/macros/s/.../exec)
 * 5. Paste into HishabKhata Pro -> Settings -> Shop Google Sheet Webhook URL
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action || 'upsert';
    var collection = payload.collection || 'SyncLogs';

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Connected to Google Sheet: ' + ss.getName(),
        shopId: payload.shopId,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = collection.charAt(0).toUpperCase() + collection.slice(1);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'ShopID', 'ShopName', 'Action', 'RecordID', 'JSON_Payload']);
    }

    var record = payload.record || {};
    var recordId = record.id || record.invoiceNo || record.billNo || '-';
    sheet.appendRow([
      new Date().toISOString(),
      payload.shopId || '',
      payload.shopName || '',
      action,
      recordId,
      JSON.stringify(record)
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      sheet: sheetName,
      recordId: recordId,
      savedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
