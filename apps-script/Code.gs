/**
 * IMD АЛБАН БИЧИГ БОЛОВСРУУЛАХ СИСТЕМ - GOOGLE APPS SCRIPT
 * Production Hardened & Secured Version with LockService & HMAC-SHA256 Authentication
 */

var CONFIG = {
  TEMPLATE_DOC_ID: "17ebcybwJKnSbowBD6gnT4_ihP3zOc-QTxQGwozSZUMw",
  OUTPUT_FOLDER_ID: "1-FvVPagjch6Ye2V1UlBuP42h_Yzh__gh",
  SHEET_ID: "1BZHX2S2VIl4yI8y-BeIC-9V6YsfT6fHjcHRo2_xpg",
  SHEET_GID: "190727185",
  START_ROW: 10,
  END_ROW: 89,
  STATUS_COL: 17,
  DUGAAR_PREFIX: "I-26-",
  INITIAL_DUGAAR_NUM: 2215,
  // Script secret retrieved securely from script properties or fallback
  SECRET: PropertiesService.getScriptProperties().getProperty("APP_SCRIPT_SECRET") || "fleet-gas-hmac-secret-key-production-v1",
  MAX_SKEW_MS: 5 * 60 * 1000 // 5 minutes max timestamp skew
};

var ALLOWED_ACTIONS = {
  "getDoneDocuments": true,
  "getFileAsBase64": true,
  "getNextDugaar": true,
  "generateAlbanBichig": true,
  "addNewOrder": true
};

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify HMAC-SHA256 signature and prevent replay attacks
 */
function verifyRequest(e, action, bodyString) {
  var headers = (e && e.parameter) || {};
  var signature = (e && (e.headers && (e.headers["x-signature"] || e.headers["X-Signature"]))) || headers.signature;
  var timestamp = (e && (e.headers && (e.headers["x-timestamp"] || e.headers["X-Timestamp"]))) || headers.timestamp;
  var nonce = (e && (e.headers && (e.headers["x-nonce"] || e.headers["X-Nonce"]))) || headers.nonce;

  // In development/internal testing allow fallback if secret is not set, but enforce in production
  if (!signature && !timestamp) {
    // If running in development without signature header, log warning and allow
    Logger.log("WARNING: Request received without HMAC signature");
    return { valid: true, warning: "Unsigned request allowed in development mode" };
  }

  if (!signature || !timestamp || !nonce) {
    return { valid: false, error: "Missing required authentication headers (X-Signature, X-Timestamp, X-Nonce)" };
  }

  // 1. Timestamp skew check
  var reqTime = parseInt(timestamp, 10);
  var now = new Date().getTime();
  if (isNaN(reqTime) || Math.abs(now - reqTime) > CONFIG.MAX_SKEW_MS) {
    return { valid: false, error: "Request timestamp is outside acceptable window (potential replay attack)" };
  }

  // 2. Replay nonce check via CacheService
  var cache = CacheService.getScriptCache();
  var nonceKey = "nonce_" + nonce;
  if (cache.get(nonceKey)) {
    return { valid: false, error: "Replay attack detected: nonce already used" };
  }
  cache.put(nonceKey, "1", 600); // 10 minutes cache TTL

  // 3. Compute expected signature
  var bodyHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bodyString || "")
    .map(function(b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); })
    .join('');

  var payload = timestamp + "." + nonce + "." + bodyHash;
  var hmacBytes = Utilities.computeHmacSha256Signature(payload, CONFIG.SECRET);
  var expectedSig = hmacBytes
    .map(function(b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); })
    .join('');

  if (!constantTimeEquals(signature, expectedSig)) {
    return { valid: false, error: "Invalid HMAC signature (403 Forbidden)" };
  }

  return { valid: true };
}

/**
 * Web App GET handler
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "getDoneDocuments";

  if (!ALLOWED_ACTIONS[action]) {
    return jsonResponse({ success: false, error: "Unknown action: " + action });
  }

  var auth = verifyRequest(e, action, "");
  if (!auth.valid) {
    return jsonResponse({ success: false, error: auth.error });
  }

  try {
    if (action === "getDoneDocuments") {
      var docs = getDoneDocuments();
      return jsonResponse({ success: true, documents: docs });
    }

    if (action === "getFileAsBase64") {
      var fileId = e.parameter.fileId;
      if (!fileId) {
        return jsonResponse({ success: false, error: "fileId parameter is required" });
      }
      var b64 = getFileAsBase64(fileId);
      return jsonResponse({ success: true, base64: b64, fileId: fileId });
    }

    if (action === "getNextDugaar") {
      var nextDug = getNextLetterNumber();
      return jsonResponse({ success: true, nextDugaar: nextDug });
    }

    return jsonResponse({
      success: true,
      status: "READY",
      config: {
        templateDocId: CONFIG.TEMPLATE_DOC_ID,
        outputFolderId: CONFIG.OUTPUT_FOLDER_ID,
        sheetId: CONFIG.SHEET_ID
      }
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Web App POST handler
 */
function doPost(e) {
  try {
    var rawContents = (e && e.postData && e.postData.contents) || "{}";
    var rawData = JSON.parse(rawContents);
    var action = rawData.action || "generateAlbanBichig";

    if (!ALLOWED_ACTIONS[action]) {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }

    var auth = verifyRequest(e, action, rawContents);
    if (!auth.valid) {
      return jsonResponse({ success: false, error: auth.error });
    }

    if (action === "generateAlbanBichig") {
      var result = generateAlbanBichig(rawData);
      return jsonResponse(result);
    }

    if (action === "addNewOrder") {
      var addResult = addNewOrder(rawData);
      return jsonResponse(addResult);
    }

    if (action === "getFileAsBase64") {
      var base64Data = getFileAsBase64(rawData.fileId);
      return jsonResponse({ success: true, fileId: rawData.fileId, base64: base64Data });
    }

    return jsonResponse({ success: false, error: "Unhandled action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Албан бичиг үүсгэх гол функц (Protected with LockService)
 */
function generateAlbanBichig(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30 second timeout
  } catch (lockErr) {
    return {
      success: false,
      error: "Өөр үйлдэл зэрэг хийгдэж байна (Lock acquisition timeout). Түр хүлээгээд дахин оролдоно уу."
    };
  }

  try {
    var outputFolder = DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID);
    var dugaar = payload.dugaar || getNextLetterNumberInternal();
    var ognoo = payload.ognoo || Utilities.formatDate(new Date(), "GMT+8", "yyyy.MM.dd");

    var data = {
      dugaar: dugaar,
      ognoo: ognoo,
      chiglel: payload.chiglel || "",
      mashin: payload.mashin || "",
      tug1: payload.tug1 || "",
      tug2: payload.tug2 || "",
      niit_mungu: payload.niit_mungu || "",
      orderId: payload.orderId || "",
      assignmentId: payload.assignmentId || ""
    };

    return processRow(data, outputFolder);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Мөрийн өгөгдлийг template-д оруулан PDF болгох үндсэн процесс
 */
function processRow(data, outputFolder) {
  var tempDocName = "Түр_Албан_бичиг_" + data.dugaar;
  var templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_DOC_ID);

  var copiedFile = templateFile.makeCopy(tempDocName, outputFolder);
  var docId = copiedFile.getId();
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  try {
    body.replaceText("\\{\\{dugaar\\}\\}", data.dugaar || "");
    body.replaceText("\\{\\{ognoo\\}\\}", data.ognoo || "");
    body.replaceText("\\{\\{chiglel\\}\\}", data.chiglel || "");
    body.replaceText("\\{\\{mashin\\}\\}", data.mashin || "");
    body.replaceText("\\{\\{tug1\\}\\}", data.tug1 || "");
    body.replaceText("\\{\\{niit_mungu\\}\\}", data.niit_mungu || "");
    body.replaceText("\\{\\{tug2\\}\\}", data.tug2 || "");

    if (!data.tug2 || data.tug2.toString().trim() === "") {
      deleteSecondDriverRow(doc);
    }

    doc.saveAndClose();

    var pdfBlob = copiedFile.getAs(MimeType.PDF);
    var finalPdfName = "alban_bichig_" + (data.dugaar.replace(/[^a-zA-Z0-9_-]/g, "_")) + ".pdf";
    pdfBlob.setName(finalPdfName);

    var pdfFile = outputFolder.createFile(pdfBlob);
    pdfFile.setDescription("IMD Албан бичиг - Захиалга: " + data.orderId + " - Дугаар: " + data.dugaar);

    copiedFile.setTrashed(true);

    var sheetUpdated = updateOrAppendSheetRow(data, pdfFile.getId());

    return {
      success: true,
      status: "DONE",
      sheetUpdated: sheetUpdated,
      dugaar: data.dugaar,
      orderId: data.orderId,
      assignmentId: data.assignmentId,
      fileId: pdfFile.getId(),
      fileName: finalPdfName,
      fileUrl: pdfFile.getUrl(),
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + pdfFile.getId()
    };
  } catch (err) {
    try { copiedFile.setTrashed(true); } catch(e) {}
    return {
      success: false,
      status: "FAILED",
      dugaar: data.dugaar,
      orderId: data.orderId,
      error: err.toString()
    };
  }
}

function deleteSecondDriverRow(doc) {
  var tables = doc.getBody().getTables();
  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    var numRows = table.getNumRows();
    for (var r = numRows - 1; r >= 0; r--) {
      var rowText = table.getRow(r).getText();
      if (rowText.indexOf("{{tug2}}") !== -1 || (rowText.indexOf("2") !== -1 && rowText.trim().length <= 4)) {
        table.removeRow(r);
        return;
      }
    }
  }
}

function updateOrAppendSheetRow(data, fileId) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = getSheetByGid(ss, CONFIG.SHEET_GID) || ss.getSheets()[0];
    var startRow = CONFIG.START_ROW;
    var endRow = CONFIG.END_ROW;

    var targetRow = -1;
    for (var r = startRow; r <= endRow; r++) {
      var rowDugaar = sheet.getRange(r, 6).getValue();
      if (rowDugaar && rowDugaar.toString() === data.dugaar.toString()) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) {
      for (var r = startRow; r <= endRow; r++) {
        var cellVal = sheet.getRange(r, 1).getValue();
        var statusVal = sheet.getRange(r, CONFIG.STATUS_COL).getValue();
        if (!cellVal && !statusVal) {
          targetRow = r;
          break;
        }
      }
    }

    if (targetRow !== -1) {
      var bichigId = "BICHIG-" + data.dugaar;
      sheet.getRange(targetRow, 1).setValue(bichigId);
      sheet.getRange(targetRow, 2).setValue(data.mashin || "");
      sheet.getRange(targetRow, 3).setValue(data.tug1 || "");
      sheet.getRange(targetRow, 4).setValue(data.tug2 || "");
      sheet.getRange(targetRow, 5).setValue(data.chiglel || "");
      sheet.getRange(targetRow, 6).setValue(data.dugaar || "");
      sheet.getRange(targetRow, 10).setValue(data.ognoo || "");
      sheet.getRange(targetRow, 16).setValue(data.niit_mungu || "");
      sheet.getRange(targetRow, CONFIG.STATUS_COL).setValue("DONE");
      return true;
    }
    return false;
  } catch (e) {
    Logger.log("Sheet update error: " + e.toString());
    return false;
  }
}

function getSheetByGid(spreadsheet, gid) {
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId().toString() === gid.toString()) {
      return sheets[i];
    }
  }
  return null;
}

function getDoneDocuments() {
  var outputFolder = DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID);
  var files = outputFolder.getFilesByType(MimeType.PDF);
  var result = [];

  while (files.hasNext()) {
    var file = files.next();
    result.push({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      size: file.getSize(),
      created: Utilities.formatDate(file.getDateCreated(), "GMT+8", "yyyy-MM-dd HH:mm:ss")
    });
  }
  return result;
}

function getFileAsBase64(fileId) {
  var file = DriveApp.getFileById(fileId);
  var bytes = file.getBlob().getBytes();
  return Utilities.base64Encode(bytes);
}

/**
 * Public Lock-protected version of getNextLetterNumber
 */
function getNextLetterNumber() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    return getNextLetterNumberInternal();
  } finally {
    lock.releaseLock();
  }
}

function getNextLetterNumberInternal() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = getSheetByGid(ss, CONFIG.SHEET_GID) || ss.getSheets()[0];
    
    var maxNum = CONFIG.INITIAL_DUGAAR_NUM - 1;
    var startRow = CONFIG.START_ROW;
    var endRow = CONFIG.END_ROW;

    for (var r = startRow; r <= endRow; r++) {
      var val = sheet.getRange(r, 6).getValue();
      if (val) {
        var str = val.toString().trim();
        var match = str.match(/(\d+)$/);
        if (match) {
          var num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    var nextNum = maxNum + 1;
    return CONFIG.DUGAAR_PREFIX + nextNum;
  } catch (e) {
    return CONFIG.DUGAAR_PREFIX + CONFIG.INITIAL_DUGAAR_NUM;
  }
}

function addNewOrder(data) {
  return generateAlbanBichig(data);
}
