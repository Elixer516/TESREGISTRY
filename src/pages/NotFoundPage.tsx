import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { landingRouteFor } from '@/lib/navigation';
import { Button, Card } from '@/components/ui';

export function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? landingRouteFor(user.role) : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Card className="max-w-md p-6 text-center">
        <p className="text-3xl font-semibold text-brand-text">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink-900">Page not found</h1>
        <p className="mt-1.5 text-sm text-ink-500">
          That address does not match any screen in RegiStream. If you followed a link from
          inside the system, it is a bug worth reporting to IT Support.
        </p>
        <Button variant="primary" className="mt-5" onClick={() => undefined}>
          <Link to={home}>Back to my home page</Link>
        </Button>
      </Card>
    </div>
  );
}
