import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '@/types';
import { DEMO_ACCOUNTS } from '@/server/data/seed';
import { useAuth } from '@/context/AuthContext';
import { landingRouteFor } from '@/lib/navigation';
import { errorMessage, isApiError } from '@/lib/api-error';
import {
  CONFIDENTIALITY_NOTICE,
  INSTITUTION,
  NON_AFFILIATION_NOTICE,
  copyrightLine,
} from '@/config/institution';
import { Button, Card, Field, InfoNote, TextInput } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoBanner } from '@/components/DemoBanner';
import korphilLogo from '@/assets/korphil-logo.png';

/**
 * Sign-in.
 *
 * There is no role picker: the account's own role decides where it lands and
 * what it can see. Picking a role at the door would make the role a client-side
 * claim, which is exactly what it must never be.
 */
export function LoginPage() {
  const { user, signIn, isRestoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (!isRestoring && user) {
    return <Navigate to={landingRouteFor(user.role)} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const signedIn = await signIn(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      const destination =
        from && from !== '/login' ? from : landingRouteFor(signedIn.role);
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  const code = isApiError(error) ? error.code : null;
  const isBlockedAccount =
    code === 'ACCOUNT_PENDING' ||
    code === 'ACCOUNT_SUSPENDED' ||
    code === 'ACCOUNT_DEACTIVATED' ||
    code === 'ACCOUNT_REJECTED' ||
    code === 'ACCOUNT_LOCKED';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DemoBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Identity panel */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-3">
              <img src={korphilLogo} alt="" aria-hidden className="h-14 w-14 object-contain" />
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink-900">
                  {INSTITUTION.systemName}
                </p>
                <p className="text-sm text-ink-500">{INSTITUTION.systemTagline}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-ink-700">{INSTITUTION.agency}</p>
            <p className="text-sm text-ink-500">{INSTITUTION.centre}</p>
            <p className="mt-1 text-xs text-ink-400">{INSTITUTION.address}</p>

            <div className="mt-6">
              <InfoNote tone="info" title="Demo accounts">
                <p className="mb-2">
                  This build has no signup backend, so accounts are seeded — the registrar, one
                  trainer per Diploma, and a trainee. Choose one to fill the form; the role
                  decides where you land.
                </p>
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.email}>
                      <button
                        type="button"
                        onClick={() => fillDemo(account.email, account.password)}
                        className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="block text-xs font-semibold text-ink-900">
                          {ROLE_LABELS[account.role]} — {account.name}
                          <span className="ml-1 font-normal text-ink-500">· {account.detail}</span>
                        </span>
                        <span className="mt-0.5 block break-all font-mono text-[11px] text-ink-500">
                          {account.email} · {account.password}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </InfoNote>
            </div>
          </div>

          {/* Sign-in card */}
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-ink-900">Sign in</h1>
                <p className="mt-0.5 text-sm text-ink-500">
                  Use your centre email address and password.
                </p>
              </div>
              <ThemeToggle compact />
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Email address" htmlFor="email" required>
                <TextInput
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@rtc-korphil.example.ph"
                  required
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <TextInput
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
                >
                  <p className="font-semibold">
                    {isBlockedAccount ? 'This account cannot sign in' : 'Sign-in failed'}
                  </p>
                  <p className="mt-0.5">{errorMessage(error)}</p>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={pending}
                disabled={!email || !password}
              >
                Sign in
              </Button>

              <p className="text-xs text-ink-500">
                Five failed attempts locks the account for 15 minutes. Contact the Registrar
                if you are locked out.
              </p>
            </form>
          </Card>
        </div>
      </div>

      <footer className="border-t border-line bg-surface px-4 py-4 text-xs text-ink-500">
        <div className="mx-auto max-w-5xl space-y-1">
          <p>{copyrightLine()}</p>
          <p className="leading-relaxed">{CONFIDENTIALITY_NOTICE}</p>
          <p className="leading-relaxed font-medium text-ink-700">{NON_AFFILIATION_NOTICE}</p>
        </div>
      </footer>
    </div>
  );
}
