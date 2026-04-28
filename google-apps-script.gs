const SHEET_ID = '1PKAc2EKqQ2B9qFTvZDnVAhYEZK8TtdkNcJbxOiCCv04';
const RECORDS_SHEET = 'Records';
const CONFIG_SHEET = 'Config';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getRecords';
  if (action === 'getRecords') {
    return jsonOutput({
      records: getAllRecords(),
      config: getConfig()
    });
  }
  return jsonOutput({ error: 'Unknown action' });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  if (payload.action === 'saveRecord') {
    upsertRecord(payload.record);
    return jsonOutput({ ok: true });
  }
  if (payload.action === 'saveConfig') {
    saveConfig(payload.config);
    return jsonOutput({ ok: true });
  }
  return jsonOutput({ error: 'Unknown action' });
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  ensureSheets(spreadsheet);
  return spreadsheet;
}

function ensureSheets(spreadsheet) {
  let recordsSheet = spreadsheet.getSheetByName(RECORDS_SHEET);
  if (!recordsSheet) {
    recordsSheet = spreadsheet.insertSheet(RECORDS_SHEET);
    recordsSheet.appendRow(['id', 'date', 'room', 'checker', 'status', 'notes', 'readings_json', 'updated_at']);
  }

  let configSheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet(CONFIG_SHEET);
    configSheet.appendRow(['min', 'max']);
    configSheet.appendRow([38, 60]);
  }
}

function getAllRecords() {
  const sheet = getSpreadsheet().getSheetByName(RECORDS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1).filter(function(row) {
    return row[0];
  }).map(function(row) {
    return {
      id: Number(row[0]),
      date: row[1],
      room: row[2],
      checker: row[3],
      status: row[4] || 'Checked',
      notes: row[5] || '',
      readings: JSON.parse(row[6] || '{}')
    };
  });
}

function upsertRecord(record) {
  const sheet = getSpreadsheet().getSheetByName(RECORDS_SHEET);
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(function(row, index) {
    if (index === 0) return false;
    return String(row[0]) === String(record.id);
  });

  const newRow = [
    record.id,
    record.date,
    record.room,
    record.checker,
    record.status || 'Checked',
    record.notes || '',
    JSON.stringify(record.readings || {}),
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }
}

function getConfig() {
  const sheet = getSpreadsheet().getSheetByName(CONFIG_SHEET);
  const row = sheet.getRange(2, 1, 1, 2).getValues()[0];
  return {
    min: Number(row[0]) || 38,
    max: Number(row[1]) || 60
  };
}

function saveConfig(config) {
  const sheet = getSpreadsheet().getSheetByName(CONFIG_SHEET);
  sheet.getRange(2, 1, 1, 2).setValues([[config.min, config.max]]);
}
