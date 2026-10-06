/**
 * Supporting documents, as the server accepts them.
 *
 * The browser uploads a file to the centre's Google Drive first and sends
 * only where it landed; a link is sent as given. Either way this is the one
 * place that decides what is acceptable, so a grading sheet and a drop case
 * cannot disagree about it.
 */

import type { Attachment, AttachmentInput, User } from '@/types';
import type { AttachmentView } from '@/types/views';
import { validationFailed } from '@/lib/api-error';
import { ATTACHMENT_MIME_TYPES } from '@/lib/attachment-rules';
import { nextId, nowIso } from '../repositories/db';
import { userDisplayName } from '../repositories/lookups';

/** Validates what a caller sent and stamps it. Throws on anything unacceptable. */
export function acceptAttachments(inputs: AttachmentInput[], actor: User): Attachment[] {
  const now = nowIso();
  return inputs.map((input, index) => {
    const which = `Attachment ${index + 1}`;
    const name = (input.name ?? '').trim();
    const url = (input.url ?? '').trim();
    if (!name) throw validationFailed(`${which} needs a name.`);
    if (!/^https:\/\/\S+$/i.test(url)) {
      throw validationFailed(`${which}: "${url || 'blank'}" is not a valid https:// link.`);
    }
    if (input.kind === 'FILE') {
      if (!input.driveFileId) throw validationFailed(`${which} was not uploaded to Drive.`);
      if (!input.mimeType || !ATTACHMENT_MIME_TYPES.includes(input.mimeType)) {
        throw validationFailed(`${which}: only PDF and Excel files are accepted.`);
      }
    } else if (input.kind !== 'LINK') {
      throw validationFailed(`${which} is neither a file nor a link.`);
    }
    return {
      id: nextId('att'),
      kind: input.kind,
      name: name.slice(0, 200),
      url,
      driveFileId: input.kind === 'FILE' ? input.driveFileId : null,
      mimeType: input.kind === 'FILE' ? input.mimeType : null,
      size: input.kind === 'FILE' ? input.size : null,
      addedAt: now,
      addedByUserId: actor.id,
    };
  });
}

/**
 * On a resubmission the caller sends the whole list again. Attachments it
 * already had keep their id and who added them; only new ones are stamped.
 */
export function mergeAttachments(
  existing: Attachment[],
  inputs: Array<AttachmentInput & { id?: string }>,
  actor: User,
): Attachment[] {
  const kept: Attachment[] = [];
  const added: AttachmentInput[] = [];
  for (const input of inputs) {
    const previous = input.id ? existing.find((a) => a.id === input.id) : undefined;
    if (previous) kept.push(previous);
    else added.push(input);
  }
  return [...kept, ...acceptAttachments(added, actor)];
}

export function toAttachmentView(attachment: Attachment): AttachmentView {
  return { ...attachment, addedByName: userDisplayName(attachment.addedByUserId) };
}
