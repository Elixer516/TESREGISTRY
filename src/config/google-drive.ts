/**
 * Google Drive configuration.
 *
 * This is the one feature in the app that touches the network. Everything
 * else runs entirely offline, and it stays that way: the Google script is
 * only fetched when a registrar actually clicks "Connect Google Drive".
 */

/**
 * An OAuth *web* client ID is public by design. It is protected by the
 * authorized JavaScript origins registered against it, not by secrecy — a
 * fork deployed to any other origin cannot use it. There is no client secret
 * anywhere in this flow, so nothing sensitive lives in the repository.
 */
const DEFAULT_CLIENT_ID =
  '1064136430223-gc6bj7a2mgjp93rigfem7bl2gu04bqnr.apps.googleusercontent.com';

export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

/**
 * The shared folder every student folder is created inside. Override with
 * VITE_DRIVE_ROOT_FOLDER_ID when pointing a different centre at this build.
 */
export const DRIVE_ROOT_FOLDER_ID: string =
  import.meta.env.VITE_DRIVE_ROOT_FOLDER_ID || '1ibb2C6lMxhr0uGn7c_0RSrCocfqU5yz6';

/**
 * Full Drive scope, because the root folder above was created by hand rather
 * than by this app — the narrower `drive.file` scope only reaches files the
 * app itself created, so it cannot write into it.
 *
 * This works today because the OAuth consent screen is in Testing mode. If
 * this is ever published to real users, it needs either Google verification
 * for this scope or a Picker-based flow that grants per-folder access.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/**
 * The Apps Script Web App that files a *public applicant's* documents.
 *
 * Only the applicant path uses this. A registrar is signed in, so their
 * uploads and deletions go straight to the Drive REST API with their own
 * token — the relay has no delete capability at all, precisely because its
 * URL is public.
 *
 * Left blank, the Identification step of the enrollment form explains that
 * uploading is unavailable rather than failing at submit time. Set it in
 * `.env.local` (gitignored) as VITE_DRIVE_RELAY_URL, and as a repository
 * secret of the same name for the GitHub Pages build.
 */
export const DRIVE_RELAY_URL: string = (
  import.meta.env.VITE_DRIVE_RELAY_URL || ''
).trim();

export function isDriveConfigured(): boolean {
  return GOOGLE_CLIENT_ID.trim().length > 0 && DRIVE_ROOT_FOLDER_ID.trim().length > 0;
}
