/**
 * Turning a picked file or a pasted link into an attachment the server will
 * accept. Files go to the centre's Google Drive through the same relay the
 * public application form uses, so nobody needs to sign in to Google.
 */

import type { AttachmentInput } from '@/types';
import { ATTACHMENT_MAX_BYTES, attachmentMimeType } from './attachment-rules';
import { uploadViaRelay, type RelaySlot } from './drive-relay';

/** A file name Drive and every operating system will keep as written. */
function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'attachment';
}

export async function uploadAttachment(
  folderName: string,
  slot: RelaySlot,
  file: File,
): Promise<AttachmentInput> {
  const mimeType = attachmentMimeType(file);
  if (!mimeType) {
    throw new Error(`"${file.name}" is not a PDF or Excel file.`);
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error(`"${file.name}" is larger than 10 MB.`);
  }

  let result;
  try {
    result = await uploadViaRelay(folderName, [
      { slot, fileName: safeFileName(file.name), file, mimeType },
    ]);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : '';
    // The relay predates these documents until it is re-deployed; say so
    // plainly, and offer the way round it.
    if (/Unexpected document type|Only PDF, JPEG and PNG/i.test(message)) {
      throw new Error(
        'The Drive upload service has not been updated for this kind of document yet. ' +
          'Attach a link to the file instead, or ask IT to re-deploy the upload script.',
      );
    }
    throw caught;
  }

  const uploaded = result.files[0];
  if (!uploaded) throw new Error('The upload did not return a file.');
  return {
    kind: 'FILE',
    name: file.name,
    url: uploaded.webViewLink,
    driveFileId: uploaded.fileId,
    mimeType,
    size: uploaded.fileSize ?? file.size,
  };
}

/** A link to a document that already lives somewhere, e.g. in Drive. */
export function linkAttachment(url: string, label: string): AttachmentInput {
  const trimmed = url.trim();
  if (!/^https:\/\/\S+$/i.test(trimmed)) {
    throw new Error('Enter a full link starting with https://');
  }
  let name = label.trim();
  if (!name) {
    try {
      name = new URL(trimmed).hostname;
    } catch {
      name = 'Link';
    }
  }
  return { kind: 'LINK', name, url: trimmed, driveFileId: null, mimeType: null, size: null };
}
