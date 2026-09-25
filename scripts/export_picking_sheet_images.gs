/**
 * Export in-cell pictures from column B to a public Drive URL in column D.
 * SKU in column E is optional — a missing SKU still gets a Link.
 *
 * Also exports any tab whose name contains "dummy" (same B → D layout).
 *
 * This project already has other .gs files. Keep these pickingImg* names.
 * Add pickingImgAddMenu() to the existing onOpen() in Code.gs.
 *
 * Menu: Picking images → Start auto export
 */

var PickingSheetImageExport = {
  sheetName: "Product Images",
  folderName: "Picking Product Images",
  imageCol: 2,
  linkCol: 4,
  skuCol: 5,
  startRow: 2,
  batchSize: 300,
  heavyBatchSize: 30,
  maxRuntimeMs: 5 * 60 * 1000,
  nextDelayMs: 60 * 1000,
  propFolder: "pickingImgFolderId",
  propTempSs: "pickingImgTempSsId",
  propProgress: "pickingImgProgress",
  propNextRow: "pickingImgNextRow",
  dummySheet: "_picking_img_dummy",
  helperNames: [
    "_picking_img_dummy",
    "_picking_img_one",
    "_picking_img_tmp",
    "_picking_img_clone",
  ],
};

/**
 * Master Products sheet config.
 * Column layout: A=Product Name, B=SKU, C=In-cell Image, D=Image URL (auto-filled).
 * Use separate document properties so progress is tracked independently.
 */
var MasterProductsExport = {
  sheetName: "Master Products",
  folderName: "Master Product Images",
  imageCol: 3,   // column C — in-cell image
  linkCol:  4,   // column D — Drive URL written here
  skuCol:   2,   // column B — SKU
  startRow: 2,
  batchSize: 300,
  heavyBatchSize: 30,
  maxRuntimeMs: 5 * 60 * 1000,
  nextDelayMs: 60 * 1000,
  propFolder:   "masterImgFolderId",
  propTempSs:   "masterImgTempSsId",
  propProgress: "masterImgProgress",
  propNextRow:  "masterImgNextRow",
  dummySheet:   "_master_img_dummy",
  helperNames: [
    "_master_img_dummy",
    "_master_img_one",
    "_master_img_tmp",
    "_master_img_clone",
  ],
};

var pickingImgUsedHeavy_ = false;

function pickingImgAddMenu() {
  SpreadsheetApp.getUi()
    .createMenu("Picking images")
    .addItem("Start auto export", "pickingImgExportBatch")
    .addItem("Retry missing links", "pickingImgRetryMissing")
    .addItem("Export dummy tabs only", "pickingImgExportDummyTabs")
    .addSeparator()
    .addItem("Stop auto export", "pickingImgRemoveTrigger")
    .addItem("Reset progress", "pickingImgResetProgress")
    .addItem("Remove dummy / helper tabs", "pickingImgRemoveDummyTabs")
    .addToUi();

  SpreadsheetApp.getUi()
    .createMenu("Master products")
    .addItem("Export images", "masterImgExportBatch")
    .addItem("Retry missing links", "masterImgRetryMissing")
    .addSeparator()
    .addItem("Stop auto export", "masterImgRemoveTrigger")
    .addItem("Reset progress", "masterImgResetProgress")
    .addToUi();
}

// ─── Master Products helpers — thin wrappers that swap the config object ────

function masterImgGetCfg() { return MasterProductsExport; }

function masterImgGetFolder() {
  var props = PropertiesService.getDocumentProperties();
  var cfg = MasterProductsExport;
  var id = props.getProperty(cfg.propFolder);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var folders = DriveApp.getFoldersByName(cfg.folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(cfg.folderName);
  try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  props.setProperty(cfg.propFolder, folder.getId());
  return folder;
}

function masterImgLoadProgress() {
  var cfg = MasterProductsExport;
  var raw = PropertiesService.getDocumentProperties().getProperty(cfg.propProgress);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return { sheetIndex: 0, row: cfg.startRow, dummyOnly: false };
}

function masterImgSaveProgress(progress) {
  PropertiesService.getDocumentProperties().setProperty(
    MasterProductsExport.propProgress,
    JSON.stringify(progress)
  );
}

function masterImgScheduleNext() {
  masterImgRemoveTrigger();
  ScriptApp.newTrigger("masterImgExportBatch")
    .timeBased()
    .after(MasterProductsExport.nextDelayMs)
    .create();
}

function masterImgRemoveTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "masterImgExportBatch") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function masterImgRetryMissing() {
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty(MasterProductsExport.propProgress);
  props.deleteProperty(MasterProductsExport.propNextRow);
  masterImgSaveProgress({ sheetIndex: 0, row: MasterProductsExport.startRow, dummyOnly: false });
  masterImgExportBatch();
}

function masterImgResetProgress() {
  masterImgRemoveTrigger();
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty(MasterProductsExport.propProgress);
  props.deleteProperty(MasterProductsExport.propNextRow);
  SpreadsheetApp.getActive().toast("Master Products export stopped and progress reset.", "Master products", 6);
}

function masterImgExportBatch() {
  DriveApp.getRootFolder();
  var cfg = MasterProductsExport;
  var started = Date.now();
  var ss = SpreadsheetApp.getActive();
  var progress = masterImgLoadProgress();
  var sheet = ss.getSheetByName(cfg.sheetName);
  if (!sheet) {
    ss.toast("Sheet '" + cfg.sheetName + "' not found. Create a tab named 'Master Products'.", "Master products", 10);
    return;
  }
  var folder = masterImgGetFolder();
  var cols = { imageCol: cfg.imageCol, linkCol: cfg.linkCol, skuCol: cfg.skuCol };
  var done = 0, skipped = 0, failed = 0, processed = 0, heavy = 0;
  var row = Math.max(cfg.startRow, Number(progress.row) || cfg.startRow);
  var lastRow = sheet.getLastRow();

  var overGrid = {};
  try {
    var images = sheet.getImages();
    for (var i = 0; i < images.length; i++) {
      var anchor = images[i].getAnchorCell();
      if (!anchor) continue;
      var r = anchor.getRow();
      if (!overGrid[r]) overGrid[r] = [];
      overGrid[r].push(images[i]);
    }
  } catch (e) {}

  for (; row <= lastRow; row++) {
    if (Date.now() - started > cfg.maxRuntimeMs) break;
    if (heavy >= cfg.heavyBatchSize) break;
    if (processed >= cfg.batchSize && heavy === 0) break;

    var sku = String(sheet.getRange(row, cols.skuCol).getDisplayValue() || "").trim();
    var existing = String(sheet.getRange(row, cols.linkCol).getDisplayValue() || "").trim();
    processed++;

    if (/^https?:\/\//i.test(existing)) { skipped++; continue; }

    var fileKey = pickingImgFileKey(sku, cfg.sheetName, row);
    try {
      var blob = pickingImgBlobFromRow(sheet, row, cols, overGrid, folder, fileKey);
      if (!blob) { skipped++; continue; }
      pickingImgWriteLink(sheet, cols, row, blob, folder, fileKey);
      if (pickingImgUsedHeavy_) heavy++;
      done++;
    } catch (e) {
      sheet.getRange(row, cols.linkCol).setNote("Export error: " + e);
      failed++;
    }

    if (done % 10 === 0) {
      masterImgSaveProgress({ sheetIndex: 0, row: row + 1 });
      ss.toast("Master Products: " + done + " exported so far…", "Master products", 3);
    }
  }

  masterImgSaveProgress({ sheetIndex: 0, row: row });

  if (row <= lastRow) {
    masterImgScheduleNext();
    ss.toast(
      "Batch done: " + done + " exported, " + skipped + " skipped. Auto-resuming in 1 min…",
      "Master products", 10
    );
  } else {
    PropertiesService.getDocumentProperties().deleteProperty(cfg.propProgress);
    masterImgRemoveTrigger();
    ss.toast(
      "All rows done. Exported " + done + ", skipped " + skipped + ", failed " + failed + ". Run portal Sync Products now.",
      "Master products", 12
    );
  }
}

function pickingImgGetFolder() {
  var props = PropertiesService.getDocumentProperties();
  var cfg = PickingSheetImageExport;
  var id = props.getProperty(cfg.propFolder);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {}
  }
  var folders = DriveApp.getFoldersByName(cfg.folderName);
  var folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(cfg.folderName);
  try {
    folder.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW,
    );
  } catch (e) {}
  props.setProperty(cfg.propFolder, folder.getId());
  return folder;
}

function pickingImgIsHelperSheet(name) {
  var n = String(name || "");
  if (n.indexOf("_picking") === 0) return true;
  var helpers = PickingSheetImageExport.helperNames;
  for (var i = 0; i < helpers.length; i++) {
    if (n === helpers[i]) return true;
  }
  return n.indexOf("Copy of Product Images") === 0;
}

function pickingImgIsDummySheet(name) {
  return /dummy/i.test(String(name || "")) && !pickingImgIsHelperSheet(name);
}

function pickingImgTargetSheets(ss, dummyOnly) {
  var sheets = ss.getSheets();
  var out = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (pickingImgIsHelperSheet(name)) continue;
    if (dummyOnly) {
      if (pickingImgIsDummySheet(name)) out.push(sheets[i]);
      continue;
    }
    if (name === PickingSheetImageExport.sheetName || pickingImgIsDummySheet(name)) {
      out.push(sheets[i]);
    }
  }
  return out;
}

function pickingImgSheetCols() {
  return {
    imageCol: PickingSheetImageExport.imageCol,
    linkCol: PickingSheetImageExport.linkCol,
    skuCol: PickingSheetImageExport.skuCol,
  };
}

function pickingImgCellHasImage(range) {
  try {
    var formula = range.getFormula();
    if (formula && /IMAGE\s*\(/i.test(formula)) return true;
  } catch (e) {}
  try {
    var value = range.getValue();
    if (!value || typeof value !== "object") return false;
    if (value.valueType === SpreadsheetApp.ValueType.IMAGE) return true;
    if (String(value.constructor && value.constructor.name).indexOf("CellImage") >= 0) {
      return true;
    }
    if (String(value).indexOf("CellImage") >= 0) return true;
  } catch (e2) {}
  return false;
}

function pickingImgTinySpreadsheet() {
  var props = PropertiesService.getDocumentProperties();
  var cfg = PickingSheetImageExport;
  var id = props.getProperty(cfg.propTempSs);
  var activeId = SpreadsheetApp.getActive().getId();
  if (id && id !== activeId) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {}
  }
  var ss = SpreadsheetApp.create("Picking Image Export Temp");
  props.setProperty(cfg.propTempSs, ss.getId());
  return ss;
}

function pickingImgFileKey(sku, sheetName, row) {
  var safeSku = String(sku || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  if (safeSku) return safeSku;
  var tab = String(sheetName || "sheet").replace(/[\\/:*?"<>|]/g, "_");
  return tab + "-row-" + row;
}

function pickingImgPublicFileUrl(file) {
  try {
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW,
    );
  } catch (e) {}
  return "https://drive.google.com/uc?export=download&id=" + file.getId();
}

function pickingImgFindExistingFile(folder, key) {
  if (!key) return null;
  var names = [
    key + ".jpg",
    key + ".jpeg",
    key + ".png",
    key + ".webp",
    key + ".gif",
  ];
  for (var i = 0; i < names.length; i++) {
    var files = folder.getFilesByName(names[i]);
    if (files.hasNext()) return files.next();
  }
  return null;
}

function pickingImgFetchBlob(url) {
  if (!url) return null;
  var attempts = [
    { muteHttpExceptions: true, followRedirects: true },
    {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    },
  ];
  for (var i = 0; i < attempts.length; i++) {
    try {
      var res = UrlFetchApp.fetch(url, attempts[i]);
      if (res.getResponseCode() >= 400) continue;
      var blob = res.getBlob();
      var type = blob.getContentType() || "";
      if (type.indexOf("text/html") >= 0) continue;
      if (blob.getBytes().length < 80) continue;
      return blob;
    } catch (e) {}
  }
  return null;
}

function pickingImgFormulaUrl(formula) {
  if (!formula) return "";
  var match = String(formula).match(
    /IMAGE\s*\(\s*["'](https?:\/\/[^"']+)["']/i,
  );
  return match ? match[1] : "";
}

function pickingImgTryContentUrl(value) {
  if (!value) return "";
  var url = "";
  try {
    url = value.getContentUrl();
  } catch (e) {
    return "";
  }
  return url ? String(url) : "";
}

function pickingImgBlobFromRange(range) {
  try {
    var fromFormula = pickingImgFetchBlob(
      pickingImgFormulaUrl(range.getFormula()),
    );
    if (fromFormula) return fromFormula;
  } catch (e) {}
  try {
    var value = range.getValue();
    var fromContent = pickingImgFetchBlob(pickingImgTryContentUrl(value));
    if (fromContent) return fromContent;
  } catch (e2) {}
  return null;
}

function pickingImgOverGridBlob(img) {
  if (!img) return null;
  try {
    if (typeof img.getBlob === "function") {
      var blob = img.getBlob();
      if (blob && blob.getBytes().length >= 80) return blob;
    }
  } catch (e) {}
  try {
    var fromUrl = pickingImgFetchBlob(img.getUrl());
    if (fromUrl) return fromUrl;
  } catch (e2) {}
  return null;
}

function pickingImgU8(b) {
  return b < 0 ? b + 256 : b;
}

function pickingImgFindBytes(bytes, sig, from) {
  for (var i = from || 0; i <= bytes.length - sig.length; i++) {
    var ok = true;
    for (var s = 0; s < sig.length; s++) {
      if (pickingImgU8(bytes[i + s]) !== sig[s]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function pickingImgImageFromPdfBlob(pdfBlob) {
  if (!pdfBlob) return null;
  var bytes = pdfBlob.getBytes();
  var jpgStart = pickingImgFindBytes(bytes, [0xff, 0xd8, 0xff], 0);
  if (jpgStart >= 0) {
    var jpgEnd = pickingImgFindBytes(bytes, [0xff, 0xd9], jpgStart + 3);
    if (jpgEnd > jpgStart) {
      var jpeg = Utilities.newBlob(
        bytes.slice(jpgStart, jpgEnd + 2),
        "image/jpeg",
        "image.jpg",
      );
      if (jpeg.getBytes().length >= 80) return jpeg;
    }
  }
  var pngStart = pickingImgFindBytes(
    bytes,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    0,
  );
  if (pngStart >= 0) {
    var pngEnd = pickingImgFindBytes(
      bytes,
      [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82],
      pngStart + 8,
    );
    if (pngEnd > pngStart) {
      var png = Utilities.newBlob(
        bytes.slice(pngStart, pngEnd + 8),
        "image/png",
        "image.png",
      );
      if (png.getBytes().length >= 80) return png;
    }
  }
  return null;
}

function pickingImgPdfExportUrl(ssId, gid, a1) {
  return (
    "https://docs.google.com/spreadsheets/d/" +
    ssId +
    "/export?format=pdf&exportFormat=pdf" +
    "&gid=" +
    gid +
    "&range=" +
    encodeURIComponent(a1) +
    "&size=A5&scale=4&fitw=true&portrait=true" +
    "&gridlines=false&sheetnames=false&printtitle=false" +
    "&pagenum=UNDEFINED&fzr=false" +
    "&top_margin=0.1&bottom_margin=0.1" +
    "&left_margin=0.1&right_margin=0.1" +
    "&horizontal_alignment=CENTER&vertical_alignment=MIDDLE"
  );
}

function pickingImgFetchAuthorized(url) {
  return UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
  });
}

function pickingImgBlobViaPdf(sheet, row, col) {
  pickingImgUsedHeavy_ = true;
  var oldH = 0;
  var oldW = 0;
  try {
    oldH = sheet.getRowHeight(row);
    oldW = sheet.getColumnWidth(col);
    if (oldH < 240) sheet.setRowHeight(row, 260);
    if (oldW < 240) sheet.setColumnWidth(col, 260);
    SpreadsheetApp.flush();

    var a1 = sheet.getRange(row, col).getA1Notation();
    var rangeToken = a1 + ":" + a1;
    var ssId = sheet.getParent().getId();
    var gid = sheet.getSheetId();
    var urls = [
      pickingImgPdfExportUrl(ssId, gid, rangeToken),
      pickingImgPdfExportUrl(ssId, gid, a1),
    ];
    for (var u = 0; u < urls.length; u++) {
      var res = pickingImgFetchAuthorized(urls[u]);
      if (res.getResponseCode() >= 400) {
        console.log("pdf " + rangeToken + " status " + res.getResponseCode());
        continue;
      }
      var fromPdf = pickingImgImageFromPdfBlob(res.getBlob());
      if (fromPdf) return fromPdf;
    }

    var htmlUrl =
      "https://docs.google.com/spreadsheets/d/" +
      ssId +
      "/gviz/tq?tqx=out:html&gid=" +
      gid +
      "&range=" +
      encodeURIComponent(rangeToken);
    var htmlRes = pickingImgFetchAuthorized(htmlUrl);
    var html = htmlRes.getContentText() || "";
    var match = html.match(/src="(https:\/\/[^"]+)"/i);
    if (match) return pickingImgFetchBlob(match[1].replace(/&amp;/g, "&"));
    return null;
  } catch (err) {
    console.log("pdf row " + row + " col " + col + ": " + err);
    return null;
  } finally {
    try {
      if (oldH) sheet.setRowHeight(row, oldH);
      if (oldW) sheet.setColumnWidth(col, oldW);
    } catch (e) {}
  }
}

function pickingImgRemoveSheetByName(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet || ss.getSheets().length <= 1) return;
  try {
    ss.deleteSheet(sheet);
  } catch (e) {}
}

function pickingImgDummyTab(ss) {
  var name = PickingSheetImageExport.dummySheet;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.hideSheet();
  }
  try {
    sheet.clear();
  } catch (e) {}
  return sheet;
}

function pickingImgApiCopyPaste(
  ssId,
  fromSheetId,
  fromRow,
  fromCol,
  toSheetId,
  toRow,
  toCol,
) {
  try {
    var url =
      "https://sheets.googleapis.com/v4/spreadsheets/" +
      ssId +
      ":batchUpdate";
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({
        requests: [
          {
            copyPaste: {
              source: {
                sheetId: fromSheetId,
                startRowIndex: fromRow - 1,
                endRowIndex: fromRow,
                startColumnIndex: fromCol - 1,
                endColumnIndex: fromCol,
              },
              destination: {
                sheetId: toSheetId,
                startRowIndex: toRow - 1,
                endRowIndex: toRow,
                startColumnIndex: toCol - 1,
                endColumnIndex: toCol,
              },
              pasteType: "PASTE_NORMAL",
              pasteOrientation: "NORMAL",
            },
          },
        ],
      }),
    });
    return res.getResponseCode() < 300;
  } catch (e) {
    return false;
  }
}

function pickingImgXlsxMediaBlob(spreadsheetId) {
  var exportUrl =
    "https://docs.google.com/spreadsheets/d/" +
    spreadsheetId +
    "/export?format=xlsx";
  var res = UrlFetchApp.fetch(exportUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
  });
  if (res.getResponseCode() >= 400) return null;
  var parts = [];
  try {
    parts = Utilities.unzip(res.getBlob().setContentType("application/zip"));
  } catch (e) {
    return null;
  }
  var best = null;
  var bestLen = 0;
  for (var i = 0; i < parts.length; i++) {
    var name = String(parts[i].getName() || "");
    if (name.indexOf("xl/media/") !== 0) continue;
    var len = parts[i].getBytes().length;
    if (len > bestLen) {
      best = parts[i];
      bestLen = len;
    }
  }
  return bestLen >= 80 ? best : null;
}

function pickingImgExportTinyFromSheet(oneSheet) {
  var tiny = pickingImgTinySpreadsheet();
  var copied = oneSheet.copyTo(tiny);
  copied.setName("img_" + new Date().getTime());
  var sheets = tiny.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (
      sheets[i].getSheetId() !== copied.getSheetId() &&
      tiny.getSheets().length > 1
    ) {
      try {
        tiny.deleteSheet(sheets[i]);
      } catch (e) {}
    }
  }
  SpreadsheetApp.flush();
  Utilities.sleep(300);
  return pickingImgXlsxMediaBlob(tiny.getId());
}

function pickingImgBlobViaDummyTab(sourceSheet, row, imageCol) {
  pickingImgUsedHeavy_ = true;
  var ss = sourceSheet.getParent();
  var stageCol = 26;
  var src = sourceSheet.getRange(row, imageCol);
  var stage = sourceSheet.getRange(row, stageCol);
  var dummy = pickingImgDummyTab(ss);

  try {
    try {
      src.copyTo(stage, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
    } catch (copyErr) {
      pickingImgApiCopyPaste(
        ss.getId(),
        sourceSheet.getSheetId(),
        row,
        imageCol,
        sourceSheet.getSheetId(),
        row,
        stageCol,
      );
    }
    SpreadsheetApp.flush();
    var blob = pickingImgBlobFromRange(stage);
    if (blob) return blob;

    try {
      stage.moveTo(dummy.getRange(1, 1));
    } catch (moveErr) {
      pickingImgApiCopyPaste(
        ss.getId(),
        sourceSheet.getSheetId(),
        row,
        imageCol,
        dummy.getSheetId(),
        1,
        1,
      );
      try {
        stage.clearContent();
      } catch (e) {}
    }
    SpreadsheetApp.flush();
    blob = pickingImgBlobFromRange(dummy.getRange(1, 1));
    if (blob) return blob;
    if (!pickingImgCellHasImage(dummy.getRange(1, 1))) return null;
    return pickingImgExportTinyFromSheet(dummy);
  } catch (err) {
    console.log("dummy tab row " + row + ": " + err);
    return null;
  } finally {
    try {
      stage.clearContent();
    } catch (e2) {}
  }
}

function pickingImgBlobFromRow(sheet, row, cols, overGrid, folder, fileKey) {
  pickingImgUsedHeavy_ = false;
  if (fileKey) {
    var existing = pickingImgFindExistingFile(folder, fileKey);
    if (existing) return existing.getBlob();
  }

  var imageCols = [cols.imageCol];
  var last = sheet.getLastColumn();
  for (var c = 1; c <= last; c++) {
    if (c === cols.imageCol || c === cols.linkCol || c === cols.skuCol) continue;
    if (pickingImgCellHasImage(sheet.getRange(row, c))) imageCols.push(c);
  }

  for (var i = 0; i < imageCols.length; i++) {
    var direct = pickingImgBlobFromRange(sheet.getRange(row, imageCols[i]));
    if (direct) return direct;
  }

  var overList = overGrid[row] || [];
  for (var j = 0; j < overList.length; j++) {
    var overBlob = pickingImgOverGridBlob(overList[j]);
    if (overBlob) return overBlob;
  }

  for (var p = 0; p < imageCols.length; p++) {
    var pdfBlob = pickingImgBlobViaPdf(sheet, row, imageCols[p]);
    if (pdfBlob) return pdfBlob;
  }

  for (var k = 0; k < imageCols.length; k++) {
    if (!pickingImgCellHasImage(sheet.getRange(row, imageCols[k]))) continue;
    var heavy = pickingImgBlobViaDummyTab(sheet, row, imageCols[k]);
    if (heavy) return heavy;
  }
  return null;
}

function pickingImgLoadProgress() {
  var props = PropertiesService.getDocumentProperties();
  var cfg = PickingSheetImageExport;
  var raw = props.getProperty(cfg.propProgress);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {}
  }
  var legacy = Number(props.getProperty(cfg.propNextRow) || cfg.startRow);
  return { sheetIndex: 0, row: legacy || cfg.startRow, dummyOnly: false };
}

function pickingImgSaveProgress(progress) {
  PropertiesService.getDocumentProperties().setProperty(
    PickingSheetImageExport.propProgress,
    JSON.stringify(progress),
  );
}

function pickingImgScheduleNext() {
  pickingImgRemoveTrigger();
  ScriptApp.newTrigger("pickingImgExportBatch")
    .timeBased()
    .after(PickingSheetImageExport.nextDelayMs)
    .create();
}

function pickingImgRetryMissing() {
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty(PickingSheetImageExport.propProgress);
  props.deleteProperty(PickingSheetImageExport.propNextRow);
  pickingImgSaveProgress({
    sheetIndex: 0,
    row: PickingSheetImageExport.startRow,
    dummyOnly: false,
  });
  pickingImgExportBatch();
}

function pickingImgExportDummyTabs() {
  pickingImgSaveProgress({
    sheetIndex: 0,
    row: PickingSheetImageExport.startRow,
    dummyOnly: true,
  });
  pickingImgExportBatch();
}

function pickingImgWriteLink(sheet, cols, row, blob, folder, fileKey) {
  var mime = blob.getContentType() || "image/jpeg";
  var ext =
    mime.indexOf("png") >= 0
      ? ".png"
      : mime.indexOf("webp") >= 0
        ? ".webp"
        : mime.indexOf("gif") >= 0
          ? ".gif"
          : ".jpg";
  blob.setName(fileKey + ext);
  var file = pickingImgFindExistingFile(folder, fileKey);
  if (!file) file = folder.createFile(blob);
  var linkCell = sheet.getRange(row, cols.linkCol);
  linkCell.setValue(pickingImgPublicFileUrl(file));
  linkCell.setNote("");
}

function pickingImgExportBatch() {
  DriveApp.getRootFolder();
  var cfg = PickingSheetImageExport;
  var started = Date.now();
  var ss = SpreadsheetApp.getActive();
  var progress = pickingImgLoadProgress();
  var sheets = pickingImgTargetSheets(ss, progress.dummyOnly);
  if (sheets.length === 0) {
    ss.toast("No Product Images or dummy tabs found.", "Picking images", 8);
    return;
  }

  var folder = pickingImgGetFolder();
  var cols = pickingImgSheetCols();
  var done = 0;
  var skipped = 0;
  var failed = 0;
  var processed = 0;
  var heavy = 0;
  var sheetIndex = Math.max(0, Number(progress.sheetIndex) || 0);
  var row = Math.max(cfg.startRow, Number(progress.row) || cfg.startRow);

  for (; sheetIndex < sheets.length; sheetIndex++) {
    var sheet = sheets[sheetIndex];
    var lastRow = sheet.getLastRow();
    if (row < cfg.startRow) row = cfg.startRow;

    var overGrid = {};
    try {
      var images = sheet.getImages();
      for (var i = 0; i < images.length; i++) {
        var anchor = images[i].getAnchorCell();
        if (!anchor) continue;
        var r = anchor.getRow();
        if (!overGrid[r]) overGrid[r] = [];
        overGrid[r].push(images[i]);
      }
    } catch (e) {}

    for (; row <= lastRow; row++) {
      if (Date.now() - started > cfg.maxRuntimeMs) break;
      if (heavy >= cfg.heavyBatchSize) break;
      if (processed >= cfg.batchSize && heavy === 0) break;

      var sku = String(
        sheet.getRange(row, cols.skuCol).getDisplayValue() || "",
      ).trim();
      var existing = String(
        sheet.getRange(row, cols.linkCol).getDisplayValue() || "",
      ).trim();
      processed++;

      if (/^https?:\/\//i.test(existing)) {
        skipped++;
        continue;
      }

      var imageRange = sheet.getRange(row, cols.imageCol);
      if (!pickingImgCellHasImage(imageRange) && !(overGrid[row] || []).length) {
        var otherImage = false;
        for (var c = 1; c <= sheet.getLastColumn(); c++) {
          if (c === cols.imageCol || c === cols.linkCol || c === cols.skuCol) continue;
          if (pickingImgCellHasImage(sheet.getRange(row, c))) {
            otherImage = true;
            break;
          }
        }
        if (!otherImage) {
          try {
            sheet.getRange(row, cols.linkCol).setNote("");
          } catch (eNote) {}
          skipped++;
          continue;
        }
      }

      var fileKey = pickingImgFileKey(sku, sheet.getName(), row);
      try {
        var blob = pickingImgBlobFromRow(
          sheet,
          row,
          cols,
          overGrid,
          folder,
          fileKey,
        );
        if (pickingImgUsedHeavy_) heavy++;
        if (!blob || blob.getBytes().length < 80) {
          failed++;
          sheet
            .getRange(row, cols.linkCol)
            .setNote("Image export failed: could not extract the picture yet.");
          continue;
        }
        pickingImgWriteLink(sheet, cols, row, blob, folder, fileKey);
        done++;
        SpreadsheetApp.flush();
      } catch (err) {
        failed++;
        if (pickingImgUsedHeavy_) heavy++;
        console.log(sheet.getName() + " row " + row + ": " + err);
        sheet
          .getRange(row, cols.linkCol)
          .setNote("Image export failed: " + err);
      }
    }

    if (row <= lastRow) break;
    row = cfg.startRow;
  }

  var unfinished = sheetIndex < sheets.length && row <= sheets[sheetIndex].getLastRow();
  if (unfinished) {
    pickingImgSaveProgress({
      sheetIndex: sheetIndex,
      row: row,
      dummyOnly: !!progress.dummyOnly,
    });
    pickingImgScheduleNext();
    ss.toast(
      "Cycle done on " +
        sheets[sheetIndex].getName() +
        " through row " +
        (row - 1) +
        " (exported " +
        done +
        ", failed " +
        failed +
        "). Next cycle starts in about 1 minute.",
      "Picking images",
      12,
    );
    return;
  }

  PropertiesService.getDocumentProperties().deleteProperty(cfg.propProgress);
  pickingImgRemoveTrigger();
  ss.toast(
    "All rows done. Exported " +
      done +
      ", skipped " +
      skipped +
      ", failed " +
      failed +
      " this cycle. Run portal Sync Data, then Sync pictures.",
    "Picking images",
    12,
  );
}

function pickingImgInstallTrigger() {
  pickingImgExportBatch();
}

function pickingImgRemoveTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "pickingImgExportBatch") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function pickingImgRemoveDummyTabs() {
  var ss = SpreadsheetApp.getActive();
  var names = PickingSheetImageExport.helperNames.slice();
  names.push("_picking_img_one", "_picking_img_tmp", "_picking_img_clone");
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (pickingImgIsHelperSheet(name) || names.indexOf(name) >= 0) {
      pickingImgRemoveSheetByName(ss, name);
    }
  }
  ss.toast("Helper / dummy export tabs removed.", "Picking images", 6);
}

function pickingImgResetProgress() {
  pickingImgRemoveTrigger();
  var props = PropertiesService.getDocumentProperties();
  props.deleteProperty(PickingSheetImageExport.propProgress);
  props.deleteProperty(PickingSheetImageExport.propNextRow);
  pickingImgRemoveDummyTabs();
  SpreadsheetApp.getActive().toast(
    "Auto export stopped, helper tabs removed, and progress reset. Existing Link URLs will still be skipped.",
    "Picking images",
    6,
  );
}
