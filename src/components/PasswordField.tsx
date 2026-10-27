import { useId, useState } from 'react';
import { PASSWORD_RULES } from '@/lib/passwords';
import { classNames } from '@/lib/format';
import { TextInput } from '@/components/ui';

/**
 * A password box that shows the rules under it and ticks each one off as it
 * is met, with a Show / Hide toggle — so whoever is choosing the password
 * sees what is missing before they press save.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label} <span className="text-danger">*</span>
      </label>
      <div className="relative">
        <TextInput
          id={inputId}
          type={shown ? 'text' : 'password'}
          value={value}
          maxLength={16}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="pr-16"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-brand-text hover:bg-surface-2"
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.key} className={classNames('flex items-center gap-1.5', met ? 'text-success-ink' : 'text-ink-500')}>
              <span aria-hidden className="w-3 text-center">{met ? '✓' : '•'}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
