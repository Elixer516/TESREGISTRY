/**
 * The chrome shared by the two public pages.
 *
 * Modelled on the sign-in page: no sidebar, no header, no session — an
 * applicant has no account and must never see staff navigation.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CONFIDENTIALITY_NOTICE,
  INSTITUTION,
  NON_AFFILIATION_NOTICE,
  copyrightLine,
} from '@/config/institution';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoBanner } from '@/components/DemoBanner';
import korphilLogo from '@/assets/korphil-logo.png';

export function ApplyShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DemoBanner />
      <header className="border-b border-line bg-surface">
        <div
          className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
        >
          <img src={korphilLogo} alt="" aria-hidden className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">
              {INSTITUTION.agencyShort} · {INSTITUTION.centreShort}
            </p>
            <p className="truncate text-xs text-ink-500">Online Enrollment Application</p>
          </div>
          <ThemeToggle compact />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:py-8">
        <div className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>{children}</div>
      </main>

      <footer className="border-t border-line bg-surface px-4 py-4 text-xs text-ink-500">
        <div className={`mx-auto space-y-1 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
          <p className="font-semibold text-ink-700">{INSTITUTION.agency}</p>
          <p>{INSTITUTION.centre} · {INSTITUTION.address}</p>
          <p>{copyrightLine()}</p>
          <p className="leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
          <p className="leading-relaxed font-medium text-ink-700">{NON_AFFILIATION_NOTICE}</p>
          <p className="pt-1">
            <Link to="/login" className="text-brand-text hover:underline">
              Staff sign-in
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
