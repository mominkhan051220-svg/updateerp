export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * HishabKhata Pro — Per-Shop Secured Google Sheet Database (Apps Script)
 * 1. Open your Shop's dedicated Google Sheet -> Extensions -> Apps Script
 * 2. In Apps Script -> Project Settings -> Script Properties, add:
 *    - SHOP_ID: (Your Shop ID from HishabKhata Settings)
 *    - SHOP_SECRET: (The per-shop Secret Key rotated/copied from Settings)
 * 3. Paste this code, then click Deploy -> New deployment -> Web app
 *    Execute as: Me | Who has access: Anyone
 * 4. Copy the Web App URL (https://script.google.com/macros/s/.../exec)
 *    and bind it in Settings -> Shop Security & Google Sheet.
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var expectedShopId = props.getProperty('SHOP_ID');
    var expectedSecret = props.getProperty('SHOP_SECRET');

    // Individual Per-Shop Security Verification
    if (expectedSecret && payload.shopSecret !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Unauthorized: Invalid per-shop secret key.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (expectedShopId && payload.shopId !== expectedShopId) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Forbidden: Shop ID mismatch for this Google Sheet.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action || 'upsert';

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Verified & Connected to Google Sheet: ' + ss.getName(),
        shopId: payload.shopId,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'restore') {
      var snapSheet = ss.getSheetByName('ShopSnapshot');
      if (!snapSheet || snapSheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'No ShopSnapshot backup found inside this Google Sheet.'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = snapSheet.getRange(2, 1, snapSheet.getLastRow() - 1, 2).getValues();
      var combined = rows.map(function (r) { return r[1] || ''; }).join('');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        snapshot: JSON.parse(combined)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload.fullSnapshot) {
      var snapTab = ss.getSheetByName('ShopSnapshot') || ss.insertSheet('ShopSnapshot');
      snapTab.clearContents();
      var json = JSON.stringify(payload.fullSnapshot);
      var chunkSize = 40000;
      var rowsToWrite = [['ChunkIndex', 'SnapshotJSON', 'UpdatedAt:' + new Date().toISOString()]];
      var idx = 1;
      for (var i = 0; i < json.length; i += chunkSize) {
        rowsToWrite.push([String(idx++), json.slice(i, i + chunkSize), '']);
      }
      snapTab.getRange(1, 1, rowsToWrite.length, 3).setValues(rowsToWrite);
    }

    var collection = payload.collection || 'SyncLogs';
    if (payload.record) {
      var sheetName = collection.charAt(0).toUpperCase() + collection.slice(1);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(['Timestamp', 'ShopID', 'ShopName', 'Action', 'RecordID', 'JSON_Payload']);
      }
      var record = payload.record;
      var recordId = record.id || record.invoiceNo || record.billNo || '-';
      sheet.appendRow([
        new Date().toISOString(),
        payload.shopId || '',
        payload.shopName || '',
        action,
        recordId,
        JSON.stringify(record)
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      savedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
