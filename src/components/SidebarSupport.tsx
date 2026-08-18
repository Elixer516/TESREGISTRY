import { useState } from 'react';
import { IT_SUPPORT } from '@/config/institution';
import { classNames } from '@/lib/format';

/**
 * IT Support block pinned to the bottom of the sidebar. When the rail is
 * collapsed it becomes a single icon with a popover.
 *
 * Contacts come from `src/config/institution.ts` and are clearly marked as
 * placeholders — nobody should mistake them for a real hotline.
 */
export function SidebarSupport({ collapsed }: { collapsed: boolean }) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        IT Support
      </p>
      <dl className="mt-1.5 space-y-1 text-xs">
        <div>
          <dt className="sr-only">Email</dt>
          <dd>
            <a
              href={`mailto:${IT_SUPPORT.email}`}
              className="break-all text-brand-text hover:underline"
            >
              {IT_SUPPORT.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Hotline</dt>
          <dd className="text-ink-700">Hotline: {IT_SUPPORT.hotline}</dd>
        </div>
        <div>
          <dt className="sr-only">Contact number</dt>
          <dd className="text-ink-700">Mobile: {IT_SUPPORT.contactNumber}</dd>
        </div>
        <div>
          <dt className="sr-only">Office hours</dt>
          <dd className="text-ink-500">{IT_SUPPORT.officeHours}</dd>
        </div>
      </dl>
      {IT_SUPPORT.isPlaceholder ? (
        <p className="mt-2 rounded border border-warning/40 bg-warning-soft px-1.5 py-1 text-[10px] leading-snug text-warning-ink">
          Placeholder contacts — replace them in <code>src/config/institution.ts</code> before
          deployment.
        </p>
      ) : null}
    </>
  );

  if (collapsed) {
    return (
      <div className="relative px-2 py-3">
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          aria-expanded={popoverOpen}
          aria-label="IT Support contacts"
          title="IT Support contacts"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-500 hover:bg-surface-2 hover:text-ink-900"
        >
          <span aria-hidden>☎</span>
        </button>
        {popoverOpen ? (
          <div
            className="animate-in absolute bottom-2 left-full z-30 ml-2 w-60 rounded-lg border border-line bg-surface p-3 shadow-xl"
            role="dialog"
            aria-label="IT Support contacts"
          >
            {body}
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="mt-2 text-[11px] font-medium text-ink-500 hover:text-ink-900"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={classNames('border-t border-line px-3 py-3')}>{body}</div>
  );
}
