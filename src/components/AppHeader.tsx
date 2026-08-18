import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROLE_LABELS } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { catalogApi } from '@/api';
import { INSTITUTION } from '@/config/institution';
import { initials } from '@/lib/format';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui';

export function AppHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const activeTerm = useQuery({
    queryKey: ['active-semester'],
    queryFn: () => catalogApi.getActiveSemester(),
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  if (!user) return null;

  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenNav}
        className="rounded-lg border border-line px-2.5 py-1.5 text-ink-700 hover:bg-surface-2 lg:hidden"
        aria-label="Open navigation"
      >
        <span aria-hidden>☰</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{INSTITUTION.systemName}</p>
        <p className="hidden truncate text-[11px] text-ink-500 sm:block">
          {INSTITUTION.agencyShort} · {INSTITUTION.centre}
        </p>
      </div>

      {activeTerm.data ? (
        <span
          title={`Active term: ${activeTerm.data.label}`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-700 sm:flex"
        >
          <span aria-hidden className="text-ink-400">
            SY
          </span>
          {activeTerm.data.academicYearLabel}
        </span>
      ) : null}

      <ThemeToggle />
      <NotificationBell />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 hover:bg-surface-2"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white"
          >
            {initials(user)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs font-semibold leading-tight text-ink-900">
              {user.firstName} {user.lastName}
            </span>
            <span className="block text-[10px] leading-tight text-ink-500">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
        </button>

        {menuOpen ? (
          <div className="animate-in absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-3 shadow-xl">
            <p className="text-sm font-semibold text-ink-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-0.5 break-all text-xs text-ink-500">{user.email}</p>
            <p className="mt-1 text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
