/**
 * Google Drive, spoken to directly from the browser.
 *
 * No SDK and no backend: Google Identity Services hands us an access token,
 * and everything after that is plain `fetch` against the Drive v3 REST API.
 *
 * Two deliberate choices worth knowing:
 *
 *  · The GIS script is injected on first use, not from index.html. Until a
 *    registrar clicks Connect, this app makes no network calls at all.
 *  · The access token is held in memory only, never localStorage. The browser
 *    token flow issues no refresh token, so it expires after about an hour
 *    and the registrar reconnects — which is the correct trade for a token
 *    that can read the centre's whole Drive.
 */

import { DRIVE_ROOT_FOLDER_ID, DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '@/config/google-drive';

/* ---------------------------------------------------------------- */
/* Minimal typings for the bits of GIS we touch                      */
/* ---------------------------------------------------------------- */

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisPromise: Promise<void> | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

/** Injects the Google Identity Services script, once, on first use. */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else reject(new Error('Google Identity Services loaded but did not initialise.'));
    };
    script.onerror = () => {
      gisPromise = null;
      reject(
        new Error(
          'Could not reach Google. Check your internet connection — document upload is the one part of this app that needs it.',
        ),
      );
    };
    document.head.appendChild(script);
  });

  return gisPromise;
}

export function isConnected(): boolean {
  return accessToken !== null && Date.now() < tokenExpiresAt;
}

/**
 * Opens Google's consent popup and keeps the resulting token in memory.
 * Resolves once a token is actually in hand, so callers can upload straight
 * after awaiting it.
 */
export function connectDrive(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(
      new Error('No Google client ID is configured, so Drive upload is unavailable.'),
    );
  }

  return loadGis().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const oauth2 = window.google?.accounts.oauth2;
        if (!oauth2) {
          reject(new Error('Google Identity Services is unavailable.'));
          return;
        }

        const client = oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(
                new Error(
                  response.error_description ??
                    response.error ??
                    'Google did not grant access.',
                ),
              );
              return;
            }
            accessToken = response.access_token;
            // Google issues ~1 hour; expire a minute early so a long upload
            // cannot start on a token that dies mid-flight.
            tokenExpiresAt = Date.now() + 59 * 60 * 1000;
            resolve();
          },
          error_callback: (error) => {
            reject(
              new Error(
                error.message ??
                  'The Google sign-in window was closed before access was granted.',
              ),
            );
          },
        });

        client.requestAccessToken();
      }),
  );
}

export function disconnectDrive(): void {
  const token = accessToken;
  accessToken = null;
  tokenExpiresAt = 0;
  if (token) window.google?.accounts.oauth2.revoke(token);
}

function requireToken(): string {
  if (!isConnected() || !accessToken) {
    throw new Error('Google Drive is not connected, or the session has expired. Connect again.');
  }
  return accessToken;
}

/** Turns a failed Drive response into something a registrar can act on. */
async function driveError(response: Response, fallback: string): Promise<Error> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    /* response was not JSON — the status alone will have to do */
  }

  if (response.status === 401 || response.status === 403) {
    accessToken = null;
    tokenExpiresAt = 0;
    return new Error(
      detail ||
        'Google refused the request. Reconnect, and check the signed-in account can edit the enrollment folder.',
    );
  }
  if (response.status === 404) {
    return new Error(
      detail || 'The enrollment folder was not found. Check the configured folder id.',
    );
  }
  return new Error(detail || `${fallback} (HTTP ${response.status})`);
}

/** Drive query strings are single-quoted, so embedded quotes must escape. */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Resolves this student's folder, creating it only if it is genuinely absent.
 *
 * The search always runs first. That is what makes the folder "created once"
 * hold even though this app's own store is wiped on every reload — Drive is
 * the durable record, the cached id is only a shortcut.
 */
export async function findOrCreateStudentFolder(folderName: string): Promise<string> {
  const token = requireToken();
  const query = [
    `name = '${escapeQueryValue(folderName)}'`,
    `'${escapeQueryValue(DRIVE_ROOT_FOLDER_ID)}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');

  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!search.ok) throw await driveError(search, 'Could not search Google Drive');

  const found = (await search.json()) as { files?: Array<{ id: string }> };
  if (found.files && found.files.length > 0) return found.files[0].id;

  const created = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [DRIVE_ROOT_FOLDER_ID],
      }),
    },
  );
  if (!created.ok) throw await driveError(created, 'Could not create the student folder');

  const folder = (await created.json()) as { id: string };
  return folder.id;
}

/**
 * Moves a file or folder to Drive's Trash.
 *
 * Deliberately `trashed: true` rather than DELETE. To the registrar this is
 * deletion — it leaves the enrolment folder and stops appearing — but Drive
 * keeps it recoverable for 30 days. Irreversibly destroying a real
 * applicant's birth certificate should not be reachable from a button, and a
 * mis-click on the wrong row is exactly how that would happen.
 *
 * Trashing a folder trashes what is inside it, so one call clears a rejected
 * applicant's whole set.
 */
export async function trashDriveItem(fileId: string): Promise<void> {
  const token = requireToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    },
  );

  // Already gone is the outcome we wanted, not a failure to report.
  if (response.status === 404) return;
  if (!response.ok) throw await driveError(response, 'Could not delete the file in Drive');
}

/** True when the id still resolves to something untrashed. */
export async function driveItemExists(fileId: string): Promise<boolean> {
  const token = requireToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return false;
  if (!response.ok) throw await driveError(response, 'Could not check the file in Drive');
  const body = (await response.json()) as { trashed?: boolean };
  return body.trashed !== true;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

/**
 * Uploads a file, or replaces one in place when `existingFileId` is given.
 *
 * Replacing rather than adding a second copy keeps the Drive link stable and
 * lets Drive's own revision history hold the previous scan — so a correction
 * never means two files whose order nobody can reconstruct later.
 */
export async function uploadToDrive(options: {
  folderId: string;
  fileName: string;
  file: File;
  existingFileId?: string | null;
}): Promise<DriveUploadResult> {
  const token = requireToken();
  const { folderId, fileName, file, existingFileId } = options;

  // Parents are set at creation only — moving a file uses addParents instead,
  // and Drive rejects the field on update.
  const metadata: Record<string, unknown> = existingFileId
    ? { name: fileName }
    : { name: fileName, parents: [folderId] };

  const body = new FormData();
  body.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  body.append('file', file);

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

  const response = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!response.ok) throw await driveError(response, 'The upload failed');

  const uploaded = (await response.json()) as { id: string; webViewLink?: string };
  return {
    fileId: uploaded.id,
    webViewLink: uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
  };
}
