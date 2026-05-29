/**
 * Code.gs — Google Apps Script backend for Lead Trainer Tablet App
 * Attached to Google Sheet: TRAINING LOG 2026
 * Sheet ID: 1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ
 */

const SHEET_ID = '1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ';
const MASTER_DB_SHEET_ID = '1USbCywgnTBiU4biCzk9G1hLKRvfR2KIcb9Ik60XsNVI';

/** Serve the HTML app or return data via query params */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  
  if (action === 'parts') {
    var parts = getPartDescriptions();
    return ContentService.createTextOutput(JSON.stringify(parts))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return HtmlService.createHtmlOutputFromFile('TrainerApp')
    .setTitle('Ramko Training Record')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Get Part#1 (Col A) and DESC#1 (Col B) from DB tab in Training Log sheet */
function getPartDescriptions() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('DB');
  if (!sheet) return [];
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // Part#1
  var colB = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // DESC#1
  
  var parts = [];
  var seen = {};
  for (var r = 0; r < colA.length; r++) {
    var partNum = (colA[r][0] || '').toString().trim();
    var desc = (colB[r][0] || '').toString().trim();
    if (partNum && !seen[partNum]) {
      seen[partNum] = true;
      parts.push({ part: partNum, desc: desc });
    }
  }
  return parts;
}

/** Get all employees */
function getEmployees() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Employee');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(e => e.employee_number); // skip empty rows
}

/** Get active Work Instructions from FN199_WI */
function getActiveWI() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('FN199_WI');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(e => (e['STATUS'] || '').toString().toLowerCase() === 'active');
}

/** Get active Quality Alerts from FN203_QL */
function getActiveQL() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('FN203_QL');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(e => (e['Status'] || '').toString().toLowerCase() === 'active');
}

/** Generate unique Training Record ID */
function generateRecordId() {
  const now = new Date();
  const date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  const time = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HHmmss');
  return 'TR-' + date + '-' + time;
}

/** Get or create a subfolder by name */
function getOrCreateSubfolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

/** Save signature image to Google Drive and return URL */
function saveSignature(base64Data, fileName, targetFolder) {
  try {
    if (!base64Data || base64Data.length < 50) return '';
    
    if (!targetFolder) {
      targetFolder = DriveApp.getFolderById('1difxUEX-K_mPNYGckSE_TOA-Rh4RmPna');
    }
    
    // Decode base64 and save
    const imageData = base64Data.replace(/^data:image\/png;base64,/, '');
    const blob = Utilities.newBlob(Utilities.base64Decode(imageData), 'image/png', fileName + '.png');
    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    Logger.log('Error saving signature: ' + e);
    return 'ERROR: ' + e.message;
  }
}

/**
 * Handle POST requests from the React web app
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'save_training') {
      var result = saveTrainingLog(data);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Save training records to FN-112_Training Log
 * Creates one row per document (WI/QL) per employee
 * @param {Object} data - { trainer, topic, employees[], results[], trainerSignature, operatorSignatures[] }
 */
function saveTrainingLog(data) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('FN-112_Training Log');
    
    var recordId = generateRecordId();
    var now = new Date();
    var signedDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
    var trainingDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'M/d/yyyy');
    
    // Determine target folder: Root > YYYY > MM Month > MMDDYYYY
    var rootFolder = DriveApp.getFolderById('1difxUEX-K_mPNYGckSE_TOA-Rh4RmPna');
    var yearStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy');
    var monthStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM MMM');
    var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMddyyyy');
    
    var yearFolder = getOrCreateSubfolder(rootFolder, yearStr);
    var monthFolder = getOrCreateSubfolder(yearFolder, monthStr);
    var targetFolder = getOrCreateSubfolder(monthFolder, dateStr);
    
    // Save trainer signature once
    var trainerSigUrl = saveSignature(data.trainerSignature, recordId + '_trainer', targetFolder);
    
    // Document numbers (combined string)
    var docString = data.topic.documentNumber || '';
    
    // Lookup Description from DB tab by Part#
    var partNum = data.topic.partNumber || '';
    var description = '';
    var dbSheet = ss.getSheetByName('DB');
    if (dbSheet && partNum) {
      var dbData = dbSheet.getDataRange().getValues();
      for (var d = 1; d < dbData.length; d++) {
        var dbPart = (dbData[d][0] || '').toString().trim();
        if (dbPart === partNum.trim()) {
          description = (dbData[d][1] || '').toString().trim();
          break;
        }
      }
    }
    if (!description) description = data.topic.description || '';
    
    // Processes selected by trainer
    var processes = data.processes || ['FN-135'];
    
    // Process each employee
    var rows = [];
    for (var i = 0; i < data.employees.length; i++) {
      var emp = data.employees[i];
      var result = data.results[i] || {};
      
      // Save operator signature
      var opSigUrl = saveSignature(
        data.operatorSignatures[i], 
        recordId + '_emp_' + emp.employee_number,
        targetFolder
      );
      
      // Create one row per selected process
      for (var p = 0; p < processes.length; p++) {
        var processName = processes[p].toUpperCase();
        
        rows.push([
          '',                                    // A - OFFICE USE ID
          partNum,                               // B - Part#
          description,                           // C - Description (from DB tab)
          docString,                             // D - Document#
          emp.employee_number,                   // E - Emp ID
          emp.first_name + ' ' + emp.last_name,  // F - Emp Name
          data.trainer.employee_number,          // G - Trainer ID
          data.trainer.first_name + ' ' + data.trainer.last_name, // H - Trainer Name
          emp.shift || '',                       // I - Shift
          trainingDate,                          // J - Training Date
          processName,                           // K - Process
          '',                                    // L - Trainer Sig (HYPERLINK below)
          '',                                    // M - Operator Sig (HYPERLINK below)
          signedDateTime,                        // N - Signed Date/Time
        ]);
      }
    }
    
    // Find last row and append
    var lastRow = sheet.getLastRow();
    if (rows.length > 0) {
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
      
      // Set HYPERLINK formulas for Trainer Sig (col L=12) and Operator Sig (col M=13)
      var sigFolderUrl = targetFolder.getUrl();
      for (var r = 0; r < rows.length; r++) {
        var rowNum = lastRow + 1 + r;
        sheet.getRange(rowNum, 12).setFormula('=HYPERLINK("' + sigFolderUrl + '","Yes")');
        sheet.getRange(rowNum, 13).setFormula('=HYPERLINK("' + sigFolderUrl + '","Yes")');
      }
    }
    
    return { success: true, recordId: recordId, count: rows.length };
  } catch (e) {
    Logger.log('Error: ' + e);
    return { success: false, error: e.message };
  }
}

/** Test function */
function testGetData() {
  Logger.log('Employees: ' + getEmployees().length);
  Logger.log('Active WI: ' + getActiveWI().length);
  Logger.log('Active QL: ' + getActiveQL().length);
}

