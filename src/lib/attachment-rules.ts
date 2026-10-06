/**
 * What may be attached as a supporting document — shared by the browser,
 * which checks before uploading, and the server, which checks again.
 */

export const ATTACHMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

/** For the file picker. */
export const ATTACHMENT_ACCEPT = '.pdf,.xlsx,.xls,' + ATTACHMENT_MIME_TYPES.join(',');

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The file's type, trusting its extension when the browser leaves the type
 * blank — Windows often reports nothing for an .xls.
 */
export function attachmentMimeType(file: File): string | null {
  if (ATTACHMENT_MIME_TYPES.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.xlsx')) return ATTACHMENT_MIME_TYPES[1];
  if (name.endsWith('.xls')) return ATTACHMENT_MIME_TYPES[2];
  return null;
}
