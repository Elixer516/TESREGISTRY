/**
 * The Supabase client, present only when the build is given a project.
 *
 * Without VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (the public
 * GitHub Pages build, for one) the app stays entirely in the browser on its
 * demonstration data. With them, sign-in and passwords go through Supabase
 * Auth. Only the publishable key ever reaches the browser.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const isSupabaseMode = supabase !== null;

/** Must match TRAINEE_EMAIL_DOMAIN in supabase/functions/accounts. */
const TRAINEE_EMAIL_DOMAIN = 'trainee.registream.invalid';

/**
 * The Auth email a sign-in identifier names. Staff type their email; a
 * trainee types their ID Number, which stands in for an email Auth requires.
 */
export function authEmailFor(identifier: string): string {
  const needle = identifier.trim().toLowerCase();
  return needle.includes('@') ? needle : `${needle}@${TRAINEE_EMAIL_DOMAIN}`;
}
