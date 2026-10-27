/**
 * What every trainee account made by approving an application starts with.
 * Known to everyone by design — which is why an account on it can do nothing
 * but replace it.
 */
export const DEFAULT_TRAINEE_PASSWORD = 'user1234';

/** The shortest and longest password anyone may set. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 16;

/** The rules, in the words shown beside every password box. */
export const PASSWORD_RULES = [
  { key: 'length', label: '8 to 16 characters', test: (pw: string) => pw.length >= MIN_PASSWORD_LENGTH && pw.length <= MAX_PASSWORD_LENGTH },
  { key: 'upper', label: 'A capital letter (A–Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { key: 'number', label: 'A number (0–9)', test: (pw: string) => /[0-9]/.test(pw) },
  { key: 'special', label: 'A special character, such as ! @ # $', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
] as const;

/**
 * Why a password may not be used, or null when it may. The same rules apply
 * wherever a password is chosen: the IT Administrator setting one for an
 * account, and a person changing their own. Supabase's `accounts` function
 * repeats them, since it sets the password itself.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Use ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) return 'Include at least one capital letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Include at least one special character, such as ! @ # $.';
  return null;
}
