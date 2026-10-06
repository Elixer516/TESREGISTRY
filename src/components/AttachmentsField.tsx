/**
 * Attach supporting documents: PDF or Excel files, uploaded to the centre's
 * Google Drive as soon as they are picked, or links to documents that
 * already live somewhere. Used by the trainer's grading sheet and by the
 * Registrar's drop cases.
 *
 * `AttachmentList` is the read-only counterpart, for whoever reviews them.
 */

import { useRef, useState } from 'react';
import type { AttachmentInput } from '@/types';
import type { AttachmentView } from '@/types/views';
import type { RelaySlot } from '@/lib/drive-relay';
import { ATTACHMENT_ACCEPT } from '@/lib/attachment-rules';
import { linkAttachment, uploadAttachment } from '@/lib/attachment-upload';
import { formatDateTime } from '@/lib/format';
import { Button, InfoNote, TextInput } from './ui';

/** An attachment being edited: new ones have no id yet. */
export type DraftAttachment = AttachmentInput & { id?: string };

function kindLabel(a: { kind: 'FILE' | 'LINK'; mimeType: string | null }): string {
  if (a.kind === 'LINK') return 'Link';
  return a.mimeType === 'application/pdf' ? 'PDF' : 'Excel';
}

function sizeLabel(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsField({
  value,
  onChange,
  folderName,
  slot,
  disabled,
}: {
  value: DraftAttachment[];
  onChange: (next: DraftAttachment[]) => void;
  /** The Drive folder new files go into. */
  folderName: string;
  slot: RelaySlot;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ url: '', label: '' });

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    let next = value;
    // One at a time, so a refusal names the file that caused it and the
    // ones before it are kept.
    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        next = [...next, await uploadAttachment(folderName, slot, file)];
        onChange(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : `Could not upload "${file.name}".`);
        break;
      }
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const addLink = () => {
    setError(null);
    try {
      onChange([...value, linkAttachment(link.url, link.label)]);
      setLink({ url: '', label: '' });
      setLinkOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That link could not be added.');
    }
  };

  const busy = disabled || uploading !== null;

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {value.map((item, index) => (
            <li key={item.id ?? `${item.url}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase text-ink-700">
                {kindLabel(item)}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-brand-text hover:underline"
              >
                {item.name}
              </a>
              <span className="shrink-0 text-xs text-ink-500">{sizeLabel(item.size)}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={`Remove ${item.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          hidden
          onChange={(event) => void pickFiles(event.target.files)}
        />
        <Button size="sm" variant="secondary" disabled={busy} loading={uploading !== null} onClick={() => inputRef.current?.click()}>
          {uploading ? `Uploading ${uploading}…` : 'Attach PDF or Excel'}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setLinkOpen((v) => !v)}>
          Add a link
        </Button>
        <span className="text-xs text-ink-500">PDF or Excel, up to 10 MB each — saved to the centre&rsquo;s Google Drive.</span>
      </div>

      {linkOpen ? (
        <div className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[2fr_1fr_auto]">
          <TextInput
            placeholder="https://drive.google.com/…"
            value={link.url}
            onChange={(event) => setLink((l) => ({ ...l, url: event.target.value }))}
            aria-label="Link"
          />
          <TextInput
            placeholder="Label (optional)"
            value={link.label}
            onChange={(event) => setLink((l) => ({ ...l, label: event.target.value }))}
            aria-label="Link label"
          />
          <Button size="sm" variant="primary" disabled={!link.url.trim()} onClick={addLink}>
            Add
          </Button>
        </div>
      ) : null}

      {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
    </div>
  );
}

export function AttachmentList({
  items,
  empty = 'Nothing attached.',
}: {
  items: AttachmentView[];
  empty?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="w-12 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase text-ink-700">
            {kindLabel(item)}
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate font-medium text-brand-text hover:underline"
          >
            {item.name}
          </a>
          <span className="text-xs text-ink-500">
            {sizeLabel(item.size)} {item.size !== null ? '· ' : ''}
            {item.addedByName}, {formatDateTime(item.addedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
