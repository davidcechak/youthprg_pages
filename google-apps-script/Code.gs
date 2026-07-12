/**
 * YouthPRG form backend.
 *
 * Receives POSTs from the newsletter and contact forms on www.youthprg.com and
 * appends them to the spreadsheet this script is bound to.
 *
 * SECURITY INVARIANT: this endpoint is append-only. The spreadsheet itself stays
 * private; the web app runs as its owner and writes on their behalf. No handler
 * may read from or return sheet contents — otherwise the public /exec URL would
 * expose the subscriber list. Keep doGet dataless.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as:      Me
 *   Who has access:  Anyone      <- "Anyone", not "Anyone with a Google account"
 * After editing this file, redeploy via Manage deployments > edit > New version
 * so the /exec URL stays the same.
 */

var SHEETS = {
  newsletter: { name: 'Newsletter', columns: ['email', 'page'] },
  contact: { name: 'Contact', columns: ['name', 'email', 'subject', 'message', 'page'] }
};

var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};

    // Honeypot: bots fill every field they find. Report success so they don't retry.
    if (params._gotcha) {
      return json({ ok: true });
    }

    var email = String(params.email || '').trim();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return json({ ok: false, error: 'invalid_email' });
    }

    var config = SHEETS[params.formType] || SHEETS.newsletter;
    var row = [new Date()].concat(
      config.columns.map(function (column) {
        return column === 'email' ? email : truncate(params[column]);
      })
    );

    // appendRow is not atomic across concurrent executions; the lock keeps two
    // simultaneous submits from landing on the same row.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sheetByName(config.name).appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server_error' });
  }
}

/** Health check only. Must never return sheet data — see the invariant above. */
function doGet() {
  return json({ ok: true });
}

function sheetByName(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function truncate(value) {
  return String(value == null ? '' : value).slice(0, 5000);
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
