import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from './states';

/**
 * Route-level gate. Hiding a link is not access control — this redirects a
 * hand-typed URL, and the service layer refuses the underlying call anyway.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <div className="p-6">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(user.role)) {
    // A trainee never sees the staff "unauthorized" page — they go home.
    return <Navigate to={user.role === 'TRAINEE' ? '/portal' : '/unauthorized'} replace />;
  }

  return <>{children}</>;
}
