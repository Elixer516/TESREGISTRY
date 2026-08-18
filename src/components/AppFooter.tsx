import { CONFIDENTIALITY_NOTICE, INSTITUTION, copyrightLine } from '@/config/institution';

/** Institutional footer, including the RA 10173 confidentiality notice. */
export function AppFooter() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-5 text-xs text-ink-500 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink-700">{INSTITUTION.agency}</span>
          <span aria-hidden className="text-ink-400">·</span>
          <span>{INSTITUTION.centre}</span>
          <span aria-hidden className="text-ink-400">·</span>
          <span>
            {INSTITUTION.systemName} — {INSTITUTION.systemTagline}
          </span>
        </div>
        <p>{copyrightLine()}</p>
        <p className="max-w-4xl leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
      </div>
    </footer>
  );
}
