import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { landingRouteFor } from '@/lib/navigation';
import { errorMessage } from '@/lib/api-error';
import { DEFAULT_TRAINEE_PASSWORD, MIN_PASSWORD_LENGTH } from '@/lib/passwords';
import { INSTITUTION, copyrightLine } from '@/config/institution';
import { Button, Card, Field, InfoNote, TextInput } from '@/components/ui';
import { DemoBanner } from '@/components/DemoBanner';
import { LoadingState } from '@/components/states';
import korphilLogo from '@/assets/korphil-logo.png';

/**
 * The first thing a trainee sees after signing in on the default password.
 *
 * Standalone, outside both layouts, so there is no sidebar or portal to
 * wander into first — and the server refuses every other call from the
 * account until this is done, so nothing is gained by trying.
 */
export function ChangePasswordPage() {
  const { user, isRestoring, changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isRestoring) {
    return (
      <div className="p-6">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to={landingRouteFor(user.role)} replace />;

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const isDefault = next === DEFAULT_TRAINEE_PASSWORD;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const updated = await changePassword(current, next);
      navigate(landingRouteFor(updated.role), { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DemoBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <img src={korphilLogo} alt="" aria-hidden className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-lg font-semibold text-ink-900">Set your own password</h1>
              <p className="text-xs text-ink-500">{INSTITUTION.centre}</p>
            </div>
          </div>

          <InfoNote tone="warning">
            Welcome, {user.firstName}. You signed in with the default password, which everyone
            is given. Choose your own before you continue to your portal.
          </InfoNote>

          <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
            <Field label="Current password" htmlFor="current" hint="The default password you just used." required>
              <TextInput
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>
            <Field
              label="New password"
              htmlFor="new"
              required
              hint={`At least ${MIN_PASSWORD_LENGTH} characters, and not the default.`}
              error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : isDefault ? 'Choose something other than the default.' : null}
            >
              <TextInput
                id="new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </Field>
            <Field
              label="Confirm new password"
              htmlFor="confirm"
              required
              error={mismatch ? 'Does not match the new password.' : null}
            >
              <TextInput
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Field>

            {error ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={pending}
              disabled={!current || !next || !confirm || mismatch || tooShort || isDefault}
            >
              Save and continue
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              Sign out instead
            </Button>
          </form>
        </Card>
      </div>
      <footer className="border-t border-line bg-surface px-4 py-3 text-center text-xs text-ink-500">
        {copyrightLine()}
      </footer>
    </div>
  );
}
