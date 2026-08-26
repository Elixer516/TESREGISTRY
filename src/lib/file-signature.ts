/**
 * File-type checking by leading bytes.
 *
 * A file renamed to `.pdf` does not get through this. The extension is a
 * claim; the bytes are the evidence — and an admission document filed under
 * the wrong type is worse than one refused at the door.
 *
 * This generalises the PDF-only check that `server/services/transcripts.ts`
 * has used since the first build, adding the image formats a 2×2 photo or a
 * phone scan actually arrives in.
 */

export type FileKind = 'pdf' | 'jpeg' | 'png';

interface Signature {
  kind: FileKind;
  /** Leading bytes that identify the format. */
  magic: number[];
  extensions: string[];
  label: string;
}

const SIGNATURES: Signature[] = [
  {
    kind: 'pdf',
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
    extensions: ['.pdf'],
    label: 'PDF',
  },
  {
    kind: 'jpeg',
    magic: [0xff, 0xd8, 0xff],
    extensions: ['.jpg', '.jpeg'],
    label: 'JPEG image',
  },
  {
    kind: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    extensions: ['.png'],
    label: 'PNG image',
  },
];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

/** Reads just enough of the file to identify it — never the whole thing. */
async function leadingBytes(file: File, count = 16): Promise<Uint8Array> {
  const buffer = await file.slice(0, count).arrayBuffer();
  return new Uint8Array(buffer);
}

/** The format this file actually is, or null if it is none of the three. */
export async function detectFileKind(file: File): Promise<FileKind | null> {
  const bytes = await leadingBytes(file);
  const match = SIGNATURES.find((signature) => startsWith(bytes, signature.magic));
  return match ? match.kind : null;
}

export function labelForKind(kind: FileKind): string {
  return SIGNATURES.find((signature) => signature.kind === kind)?.label ?? kind;
}

export interface SignatureCheck {
  ok: boolean;
  kind: FileKind | null;
  message: string;
}

/**
 * Confirms the file both carries an allowed extension and really is what that
 * extension claims. Returns rather than throws, since the caller is a form
 * that wants to show the problem beside the field.
 */
export async function checkFileSignature(
  file: File,
  allowedExtensions: string[],
): Promise<SignatureCheck> {
  const dot = file.name.lastIndexOf('.');
  const extension = dot > 0 ? file.name.slice(dot).toLowerCase() : '';

  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      kind: null,
      message: `This slot accepts ${allowedExtensions.join(', ')} — "${file.name}" is not one of those.`,
    };
  }

  const kind = await detectFileKind(file);
  if (!kind) {
    return {
      ok: false,
      kind: null,
      message:
        'That file is not a PDF, JPEG or PNG. Its contents begin with something else, whatever the file name says.',
    };
  }

  const signature = SIGNATURES.find((s) => s.kind === kind);
  if (signature && !signature.extensions.includes(extension)) {
    return {
      ok: false,
      kind,
      message: `"${file.name}" is named ${extension} but its contents are a ${signature.label}. Re-save it in the right format.`,
    };
  }

  return { ok: true, kind, message: '' };
}
