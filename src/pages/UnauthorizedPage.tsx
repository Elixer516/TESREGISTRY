import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { landingRouteFor, navItemsFor } from '@/lib/navigation';
import { Button, Card, InfoNote } from '@/components/ui';

export function UnauthorizedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-danger-ink">
          Access denied
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">
          That screen is not part of your role
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {user
            ? 'Your account is signed in as ' +
              ROLE_LABELS[user.role] +
              ', which does not include this screen.'
            : 'You are not signed in.'}
        </p>

        <InfoNote tone="info" title="Why you are seeing this">
          <p>
            Navigation only lists what your role can use, so this page is normally
            unreachable. Typing the address directly bypasses the menu but not the rules — the
            request would have been refused by the server as well.
          </p>
        </InfoNote>

        {user ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Screens available to you
            </p>
            <ul className="flex flex-wrap gap-2">
              {navItemsFor(user.role).map((item) => (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-700 hover:bg-surface-2"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button
          variant="primary"
          className="mt-6"
          onClick={() => navigate(user ? landingRouteFor(user.role) : '/login')}
        >
          Go to my dashboard
        </Button>
      </Card>
    </div>
  );
}
