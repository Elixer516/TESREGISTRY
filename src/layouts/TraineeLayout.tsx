import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { TRAINEE_NAV } from '@/lib/navigation';
import { AppHeader } from '@/components/AppHeader';
import { AppFooter } from '@/components/AppFooter';
import { DemoBanner } from '@/components/DemoBanner';
import { Sidebar } from '@/components/Sidebar';
import { LoadingState } from '@/components/states';

/**
 * The trainee shell — deliberately separate from the staff one. A trainee has
 * no route into the staff application at all; the router sends them here.
 */
export function TraineeLayout() {
  const { user, isRestoring } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isRestoring) {
    return (
      <div className="p-6">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'TRAINEE') return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        items={TRAINEE_NAV}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <AppHeader onOpenNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
