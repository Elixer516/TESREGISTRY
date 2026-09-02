import { DEMO_BANNER } from '@/config/institution';

/**
 * The demonstration notice, pinned to the top of every page.
 *
 * Google Safe Browsing flagged the deployed site as deceptive, and it was not
 * wrong to: a page carrying a government agency's name and seal, asking for a
 * password, and collecting birth certificates from the public is the exact
 * shape of an impersonation attack. What separated this from one was context a
 * crawler had no way to see.
 *
 * So this states it in the markup, before anything else on the page, where
 * both a visitor and a classifier meet it first. It is deliberately loud and
 * deliberately not dismissible — a notice a viewer can close is a notice the
 * next crawl will not find.
 */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="border-b border-warning/40 bg-warning-soft px-4 py-2 text-center text-xs font-medium leading-relaxed text-warning-ink sm:px-6"
    >
      <span aria-hidden className="mr-1.5">⚠</span>
      {DEMO_BANNER}
    </div>
  );
}
