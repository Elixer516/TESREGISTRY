/**
 * The applicant's route into the centre's Google Drive.
 *
 * A public applicant has no Google session we can use — a token they granted
 * would authorise *their* Drive, not the centre's — so their two scans go to
 * an Apps Script Web App that holds the centre's authority server-side and
 * writes the files on their behalf. See `google-apps-script/` for the script
 * and its deployment steps.
 *
 * The registrar's own uploads do not come through here. They are signed in,
 * so `@/lib/google-drive` talks to the Drive REST API directly with their
 * token — which is also why deletion lives there and not in the relay.
 */

import { DRIVE_RELAY_URL } from '@/config/google-drive';

export interface RelayFileInput {
  slot: 'ID_PICTURE' | 'BIRTH_CERTIFICATE';
  fileName: string;
  file: File;
}

export interface RelayFileResult {
  slot: 'ID_PICTURE' | 'BIRTH_CERTIFICATE';
  fileName: string;
  fileId: string;
  webViewLink: string;
  fileSize: number;
  mimeType: string;
}

export interface RelayResult {
  folderId: string;
  folderName: string;
  files: RelayFileResult[];
}

export function isRelayConfigured(): boolean {
  return DRIVE_RELAY_URL.length > 0;
}

/** Reads a File into base64 without the `data:...;base64,` prefix. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Could not read "${file.name}".`));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads the applicant's documents and returns where they landed.
 *
 * Sent as `text/plain` on purpose: that keeps it a CORS "simple request", so
 * the browser skips the preflight OPTIONS that Apps Script does not answer.
 * The body is still JSON, and the script parses it as such.
 */
export async function uploadViaRelay(
  folderName: string,
  files: RelayFileInput[],
): Promise<RelayResult> {
  if (!isRelayConfigured()) {
    throw new Error(
      'Online document upload is not configured for this build, so the form cannot file your documents.',
    );
  }

  const payload = {
    folderName,
    files: await Promise.all(
      files.map(async (item) => ({
        slot: item.slot,
        fileName: item.fileName,
        mimeType: item.file.type || 'application/octet-stream',
        dataBase64: await toBase64(item.file),
      })),
    ),
  };

  let response: Response;
  try {
    response = await fetch(DRIVE_RELAY_URL, {
      method: 'POST',
      // Apps Script follows a redirect to googleusercontent.com to serve the
      // response; without this the fetch resolves to an opaque result.
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Could not reach the upload service. Check your internet connection and try again.',
    );
  }

  if (!response.ok) {
    throw new Error(`The upload service refused the request (HTTP ${response.status}).`);
  }

  let body: { ok?: boolean; data?: RelayResult; error?: string };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new Error(
      'The upload service returned something unexpected. It may need to be re-deployed.',
    );
  }

  if (!body.ok || !body.data) {
    throw new Error(body.error ?? 'The upload could not be completed.');
  }
  return body.data;
}
