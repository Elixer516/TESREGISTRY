import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { INSTITUTION } from '@/config/institution';
import { initials } from '@/lib/format';
import { AppFooter } from '@/components/AppFooter';
import { DemoBanner } from '@/components/DemoBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoadingState } from '@/components/states';
import { Button } from '@/components/ui';
import { ChangePasswordModal } from '@/pages/portal/ChangePasswordModal';
import korphilLogo from '@/assets/korphil-logo.png';

/** The portal's sections, in the order a trainee reaches for them. */
const PORTAL_TABS = [
  { to: '/portal', label: 'Home', icon: '⌂', end: true },
  { to: '/portal/grades', label: 'Grades', icon: '★', end: false },
  { to: '/portal/curriculum', label: 'My Curriculum', icon: '☰', end: false },
  { to: '/portal/schedule', label: 'Schedule', icon: '◷', end: false },
  { to: '/portal/evaluations', label: 'Evaluations', icon: '✎', end: false },
  { to: '/portal/profile', label: 'Profile', icon: '◉', end: false },
] as const;

/**
 * The trainee's own shell — deliberately not the staff one.
 *
 * Staff work across many records, so their shell is a sidebar of tools. A
 * trainee has one record, their own, so this shell puts *them* at the top: a
 * banner with their name, ID Number, diploma and current term, then a row of
 * tabs. On a phone — where most trainees will open it — the tabs move to a
 * bar along the bottom, within reach of a thumb.
 */
export function TraineeLayout() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return (
      <div className="p-6">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // The portal stays shut until the default password has been replaced.
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (user.role !== 'TRAINEE') return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-16 sm:pb-0">
      <DemoBanner />
      <PortalTopBar />
      <PortalBanner />

      {/* Tabs: a row of pills on a wide screen, sticky under the top bar. */}
      <nav
        aria-label="Portal"
        className="no-print sticky top-[3.25rem] z-20 hidden border-b border-line bg-surface/95 backdrop-blur sm:block"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-4 py-2.5">
          {PORTAL_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ' +
                (isActive
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-700 hover:bg-surface-2 hover:text-ink-900')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      <AppFooter />

      {/* …and a bottom bar on a phone. */}
      <nav
        aria-label="Portal"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface sm:hidden"
      >
        {PORTAL_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ' +
              (isActive ? 'text-brand-text' : 'text-ink-500')
            }
          >
            <span aria-hidden className="text-base leading-none">
              {tab.icon}
            </span>
            {tab.label === 'My Curriculum' ? 'Curriculum' : tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function PortalTopBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.25rem] max-w-5xl items-center gap-3 px-4">
        <img src={korphilLogo} alt="" aria-hidden className="h-8 w-8 object-contain" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-ink-900">
            {INSTITUTION.systemName} <span className="font-semibold text-brand-text">Trainee Portal</span>
          </p>
          <p className="truncate text-[11px] text-ink-500">{INSTITUTION.centre}</p>
        </div>
        <ThemeToggle />
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Account"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
          >
            {initials(user)}
          </button>
          {open ? (
            <div className="animate-in absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-3 shadow-xl">
              <p className="text-sm font-semibold text-ink-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-ink-500">Trainee</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  setOpen(false);
                  setPasswordOpen(true);
                }}
              >
                Change password
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                  navigate('/login', { replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}

/**
 * Who this portal belongs to, always in view: name, ID Number, diploma,
 * section and the term they are in. Drawn in the centre's colours rather
 * than with a photograph, so it reads the same in light and dark themes.
 */
function PortalBanner() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const data = query.data && query.data.kind === 'TRAINEE' ? query.data : null;

  return (
    <section className="no-print relative overflow-hidden bg-[#13294b] text-white">
      {/* A fine diagonal weave and a soft glow — texture, not decoration. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 14px)',
        }}
      />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#2f8f83] opacity-40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#e0a526] opacity-20 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6 sm:py-7">
        <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-lg ring-4 ring-white/20">
          <img src={korphilLogo} alt="" aria-hidden className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          {data ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3c55b]">
                {data.student.studentNumber}
              </p>
              <h1 className="mt-0.5 truncate text-xl font-bold sm:text-2xl">
                {data.student.lastName.toUpperCase()}, {data.student.firstName}
                {data.student.middleName ? ` ${data.student.middleName.charAt(0)}.` : ''}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">{data.programName}</p>
            </>
          ) : (
            <p className="text-white/70">Loading your record…</p>
          )}
        </div>
        {data ? (
          <dl className="flex flex-wrap gap-2 text-xs sm:justify-end">
            <Chip label="Year" value={`Year ${data.student.yearLevel}`} />
            <Chip label="Section" value={data.sectionCode ?? 'Not assigned'} />
            <Chip
              label="Term"
              value={
                data.activeTerm
                  ? `${data.activeTerm.academicYearLabel} · ${data.activeTerm.termLabel}`
                  : 'No open term'
              }
            />
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur">
      <dt className="text-[10px] uppercase tracking-wider text-white/60">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  );
}
