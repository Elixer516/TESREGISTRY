import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { navItemsFor } from '@/lib/navigation';
import { documentRequestsApi, headTrainerApi } from '@/api';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { DemoBanner } from '@/components/DemoBanner';
import { Sidebar } from '@/components/Sidebar';
import { LoadingState } from '@/components/states';

const COLLAPSE_KEY = 'registream.sidebar.collapsed';

/** Shell for every staff role. Trainees get their own shell instead. */
export function RootLayout() {
  const { user, isRestoring } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* the preference simply will not persist */
      }
      return next;
    });
  }, []);

  // Diploma Grades is listed only for a trainer who heads a diploma.
  const head = useQuery({
    queryKey: ['am-i-head', user?.id],
    queryFn: () => headTrainerApi.amI(),
    enabled: user?.role === 'TRAINER' && !user.mustChangePassword,
  });
  const isHead = head.data === true;

  // New document requests waiting for the Registrar, shown on the sidebar
  // link. Any change made on the requests page refreshes this through the
  // shared 'document-requests' key; the interval picks up trainees' new ones.
  const pendingRequests = useQuery({
    queryKey: ['document-requests', 'PENDING'],
    queryFn: () => documentRequestsApi.list('PENDING'),
    enabled: user?.role === 'REGISTRAR' && !user.mustChangePassword,
    refetchInterval: 60_000,
  });
  const badges = { '/document-requests': pendingRequests.data?.length ?? 0 };

  // Lock the page behind the drawer while it is open on small screens.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  if (isRestoring) {
    return (
      <div className="p-6">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (user.role === 'TRAINEE') return <Navigate to="/portal" replace />;
  const items = navItemsFor(user.role).filter((item) => !item.headOnly || isHead);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        items={items}
        badges={badges}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <AppHeader onOpenNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
