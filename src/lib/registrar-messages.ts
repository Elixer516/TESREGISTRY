/**
 * The Registrar's standard emails.
 *
 * This prototype has no mail server, so the Registrar sends from their own
 * mailbox: each message opens in their email app with the address, subject
 * and wording already filled in, and they attach the document and send. The
 * wording lives here so every trainee receives the same message.
 */

import { INSTITUTION } from '@/config/institution';

/** A mailto: link that opens the Registrar's email app with this message. */
export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const SIGN_OFF = `\n\nOffice of the Registrar\n${INSTITUTION.centre}`;

/**
 * "You still lack these requirements" — sent when a trainee who asked for a
 * document, or who is about to graduate, has not completed every admission
 * requirement. Nothing can be processed until they do.
 */
export function lackingRequirementsMessage(input: {
  firstName: string;
  missing: string[];
  /** e.g. "your request DR-2026-0004 (Transcript of Records)" or "your graduation clearance" */
  regarding: string;
}): { subject: string; body: string } {
  const list = input.missing.map((m, i) => `  ${i + 1}. ${m}`).join('\n');
  return {
    subject: `Requirements needed — ${input.regarding}`,
    body:
      `Dear ${input.firstName},\n\n` +
      `We cannot process ${input.regarding} yet. Our records show you have not yet submitted the following requirement${
        input.missing.length === 1 ? '' : 's'
      }:\n\n${list}\n\n` +
      `Please submit ${input.missing.length === 1 ? 'it' : 'them'} to the Office of the Registrar. ` +
      `We will continue as soon as your requirements are complete.` +
      SIGN_OFF,
  };
}

/** The reference number and status of a document request, with the document attached when ready. */
export function requestUpdateMessage(input: {
  firstName: string;
  referenceNumber: string;
  documentLabel: string;
  statusLabel: string;
  ready: boolean;
}): { subject: string; body: string } {
  return {
    subject: `${input.documentLabel} — ${input.referenceNumber}`,
    body:
      `Dear ${input.firstName},\n\n` +
      (input.ready
        ? `Your requested ${input.documentLabel} is attached to this email.\n\n`
        : `We have received your request for a ${input.documentLabel}. Its status is: ${input.statusLabel}.\n\n`) +
      `Reference number: ${input.referenceNumber}\n` +
      `Please quote it in any follow-up.` +
      SIGN_OFF,
  };
}
