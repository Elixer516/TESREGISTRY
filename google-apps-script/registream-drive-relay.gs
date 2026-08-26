/**
 * RegiStream — enrollment document relay.
 *
 * Deployed as a Web App from the centre's own Google account, this is what
 * lets a public applicant's Valid ID and Birth Certificate reach the centre's
 * Drive. The applicant's browser never holds a credential: it POSTs the two
 * files here, and this script writes them as the account that owns it.
 *
 * WHY THIS EXISTS AT ALL
 * The enrollment form is a static site with no backend. A browser OAuth token
 * would authorise the *applicant's* Drive, not the centre's, and a service
 * account key shipped to a public site is a key anyone can read. A relay that
 * holds the authority server-side is the only safe arrangement.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It cannot read, list, move or delete anything. It creates a folder and
 * writes files into ROOT_FOLDER_ID, and that is the entire surface. Deletion
 * is done by the registrar from the app using their own signed-in Drive
 * session, so this public endpoint can never be made to destroy a record.
 *
 * RESIDUAL RISK, STATED PLAINLY
 * The URL is public and unauthenticated, because the applicant is. Anyone who
 * finds it can push files into the enrolment folder, within the limits below.
 * The caps make that a nuisance rather than a breach, but if it is ever
 * abused, redeploy with a fresh URL and put a captcha in front of the form.
 *
 * ── DEPLOYMENT ────────────────────────────────────────────────────────────
 * 1. script.google.com → New project → paste this file.
 * 2. Set ROOT_FOLDER_ID below to the enrolment folder id.
 * 3. Deploy → New deployment → type "Web app".
 *      Execute as:      Me (the centre's account)
 *      Who has access:  Anyone
 *    "Anyone" here means anyone may call the script; it does NOT make the
 *    Drive folder public. The folder's own sharing stays private.
 * 4. Authorise when prompted, then copy the /exec URL.
 * 5. Put it in the app's .env.local as:
 *      VITE_DRIVE_RELAY_URL=https://script.google.com/macros/s/…/exec
 *    and for the GitHub Pages build, as a repository *variable* of the same
 *    name (Settings > Secrets and variables > Actions > Variables). A
 *    variable, not a secret: it is compiled into the client bundle either
 *    way, so secrecy would be a false promise — keeping it out of the repo
 *    just means it can be rotated without a commit.
 * 6. Re-deploy this script (Manage deployments → edit → Version: New) after
 *    ANY edit — Apps Script serves the last deployed version, not the saved
 *    one, which is the usual reason a change appears to do nothing.
 */

/** The enrolment folder every student folder is created inside. */
var ROOT_FOLDER_ID = '1ibb2C6lMxhr0uGn7c_0RSrCocfqU5yz6';

/** Caps. A public endpoint gets exactly as much as it needs and no more. */
var MAX_FILES_PER_REQUEST = 2;
var MAX_FILE_BYTES = 5 * 1024 * 1024;
var ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
var ALLOWED_SLOTS = ['ID_PICTURE', 'BIRTH_CERTIFICATE'];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return fail('Empty request.');
    }

    var body = JSON.parse(e.postData.contents);
    var folderName = sanitiseFolderName(body.folderName);
    if (!folderName) return fail('A folder name is required.');

    var files = body.files;
    if (!Array.isArray(files) || files.length === 0) {
      return fail('No files were sent.');
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return fail('Too many files in one request.');
    }

    // Validate every file BEFORE creating anything, so a rejected upload
    // cannot leave an empty folder behind.
    var prepared = [];
    for (var i = 0; i < files.length; i++) {
      prepared.push(validateFile(files[i]));
    }

    var folder = findOrCreateFolder(folderName);
    var written = [];

    for (var j = 0; j < prepared.length; j++) {
      var item = prepared[j];
      var blob = Utilities.newBlob(
        Utilities.base64Decode(item.dataBase64),
        item.mimeType,
        item.fileName
      );
      var created = folder.createFile(blob);
      written.push({
        slot: item.slot,
        fileName: item.fileName,
        fileId: created.getId(),
        webViewLink: created.getUrl(),
        fileSize: item.byteLength,
        mimeType: item.mimeType
      });
    }

    return ok({ folderId: folder.getId(), folderName: folderName, files: written });
  } catch (err) {
    // A rejected file is the caller's problem and they are told exactly what
    // was wrong. Anything else is ours, and is logged rather than echoed —
    // a raw Drive exception can carry folder ids and account names.
    if (err && err.isValidation) {
      return fail(err.message);
    }
    console.error(err);
    return fail('The upload could not be completed. Please try again.');
  }
}

/** An error safe to show the person who sent the request. */
function refuse(message) {
  var err = new Error(message);
  err.isValidation = true;
  return err;
}

/** Rejects anything that is not one of the two expected scans. */
function validateFile(file) {
  if (!file || typeof file.dataBase64 !== 'string' || !file.dataBase64) {
    throw refuse('A file was empty.');
  }
  if (ALLOWED_SLOTS.indexOf(file.slot) === -1) {
    throw refuse('Unexpected document type.');
  }
  if (ALLOWED_MIME.indexOf(file.mimeType) === -1) {
    throw refuse('Only PDF, JPEG and PNG files are accepted.');
  }

  // base64 is 4 characters per 3 bytes; close enough to enforce the cap
  // without decoding the whole payload first.
  var byteLength = Math.floor((file.dataBase64.length * 3) / 4);
  if (byteLength > MAX_FILE_BYTES) {
    throw refuse('That file is larger than 5 MB.');
  }

  var fileName = String(file.fileName || '').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!fileName) throw refuse('A file name is required.');

  return {
    slot: file.slot,
    fileName: fileName,
    mimeType: file.mimeType,
    dataBase64: file.dataBase64,
    byteLength: byteLength
  };
}

/**
 * Searches before creating, so a resubmission or a retry lands in the folder
 * that already exists rather than making a second one beside it.
 */
function findOrCreateFolder(name) {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var existing = root.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(name);
}

/** Folder names are built from a person's name, so keep it to that shape. */
function sanitiseFolderName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function ok(payload) {
  return json({ ok: true, data: payload });
}

function fail(message) {
  return json({ ok: false, error: message });
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** A GET is only ever a human checking the deployment is alive. */
function doGet() {
  return json({ ok: true, service: 'RegiStream drive relay' });
}
