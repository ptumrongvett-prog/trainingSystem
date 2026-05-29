/**
 * Code.gs — Google Apps Script backend for Lead Trainer Tablet App
 * Attached to Google Sheet: TRAINING LOG 2026
 * Sheet ID: 1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ
 */

const SHEET_ID = '1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ';

/** Serve the HTML app */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('TrainerApp')
    .setTitle('Ramko Training Record')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
 * Save training records to FN-112_Training Log
 * @param {Object} data - { trainer, topic, employees[], results[], trainerSig, signatures[] }
 */
function saveTrainingLog(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('FN-112_Training Log');
    
    const recordId = generateRecordId();
    const now = new Date();
    const signedDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
    
    // Determine target folder: Root > YYYY > MM Month > MMDDYYYY
    const rootFolder = DriveApp.getFolderById('1difxUEX-K_mPNYGckSE_TOA-Rh4RmPna');
    const yearStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy');
    const monthStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM MMM');
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMddyyyy');
    
    const yearFolder = getOrCreateSubfolder(rootFolder, yearStr);
    const monthFolder = getOrCreateSubfolder(yearFolder, monthStr);
    const targetFolder = getOrCreateSubfolder(monthFolder, dateStr);
    
    // Save trainer signature once
    const trainerSigUrl = saveSignature(data.trainerSignature, recordId + '_trainer', targetFolder);
    
    // Process each employee
    const rows = [];
    for (let i = 0; i < data.employees.length; i++) {
      const emp = data.employees[i];
      const result = data.results[i];
      
      // Save operator signature
      const opSigUrl = saveSignature(
        data.operatorSignatures[i], 
        recordId + '_emp_' + emp.employee_number,
        targetFolder
      );
      
      rows.push([
        '',                                    // Column A - OFFICE USE ID
        data.topic.partNumber || '',           // Part#
        data.topic.description || '',          // Description
        data.topic.documentNumber || '',       // Document#
        emp.employee_number,                   // Emp ID
        emp.first_name + ' ' + emp.last_name,  // Emp Name
        data.trainer.employee_number,          // Trainer ID
        data.trainer.first_name + ' ' + data.trainer.last_name, // Trainer Name
        emp.shift || '',                       // Shift
        Utilities.formatDate(now, Session.getScriptTimeZone(), 'M/d/yyyy'), // Training Date
        data.topic.type === 'WI' ? 'WORK INSTRUCTIONS' : 'QUALITY ALERT', // Process
        result.comments || '',                 // Comments
        result.passed ? 'PASS' : 'FAIL',      // Result
        trainerSigUrl,                         // Trainer Signature
        opSigUrl,                              // Operator Signature
        signedDateTime,                        // Signed Date/Time
        recordId,                              // Training Record ID
      ]);
    }
    
    // Find last row and append
    const lastRow = sheet.getLastRow();
    if (rows.length > 0) {
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
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
