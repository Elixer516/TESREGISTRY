/**
 * A single drag-and-drop upload slot.
 *
 * Validation happens the moment a file is chosen rather than at submit time,
 * so an applicant who picks the wrong thing finds out while they are still
 * looking at the field. The check reads the file's leading bytes, not its
 * extension — a JPEG renamed to .pdf is refused here.
 */

import { useRef, useState } from 'react';
import { checkFileSignature } from '@/lib/file-signature';
import { classNames } from '@/lib/format';
import { Button } from '@/components/ui';

export interface FileDropZoneProps {
  label: string;
  hint?: string;
  accept: string[];
  file: File | null;
  onChange: (file: File | null) => void;
  /** Locked once the application has been submitted. */
  disabled?: boolean;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropZone({
  label,
  hint,
  accept,
  file,
  onChange,
  disabled = false,
  maxBytes = DEFAULT_MAX_BYTES,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept_ = async (candidate: File) => {
    setError(null);

    if (candidate.size === 0) {
      setError(`"${candidate.name}" is empty.`);
      return;
    }
    if (candidate.size > maxBytes) {
      setError(
        `"${candidate.name}" is ${formatSize(candidate.size)}. The limit is ${formatSize(maxBytes)} — try a smaller scan.`,
      );
      return;
    }

    setChecking(true);
    try {
      const check = await checkFileSignature(candidate, accept);
      if (!check.ok) {
        setError(check.message);
        return;
      }
      onChange(candidate);
    } finally {
      setChecking(false);
      // Let the same file be re-picked after a rejection.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const describedBy = `${label.replace(/\W+/g, '-').toLowerCase()}-help`;

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink-700">
        {label}
        <span className="ml-0.5 text-danger">*</span>
      </p>

      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success-soft px-3.5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-success-ink">{file.name}</p>
            <p className="text-xs text-success-ink/80">{formatSize(file.size)} · ready to submit</p>
          </div>
          {!disabled ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              Change
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-describedby={describedBy}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            if (disabled) return;
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) void accept_(dropped);
          }}
          className={classNames(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
            disabled
              ? 'cursor-not-allowed border-line bg-surface-2 opacity-60'
              : 'cursor-pointer border-line hover:border-accent hover:bg-surface-2',
            dragging && 'border-accent bg-info-soft',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
            className="h-9 w-9 text-ink-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6.2 4.5 4.5 0 1117 16H7z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v6m0-6l-2.5 2.5M12 12l2.5 2.5" />
          </svg>
          <p className="text-sm text-ink-700">
            {checking ? 'Checking the file…' : `Drag and drop or upload your ${label}.`}
          </p>
          <p id={describedBy} className="text-xs text-ink-500">
            {accept.join(', ')} · up to {formatSize(maxBytes)}
            {hint ? ` · ${hint}` : ''}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept.join(',')}
        disabled={disabled}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) void accept_(picked);
        }}
      />

      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
