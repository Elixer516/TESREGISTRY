import { useEffect, useState } from 'react';
import { Select, TextInput } from '@/components/ui';

const OTHERS = '__others__';

/**
 * A dropdown with "Others (please specify)" at the end, which opens a box for
 * the trainee's own words. One value comes out either way: the option chosen,
 * or what was typed.
 */
export function OptionOrOther({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  otherPlaceholder = 'Please specify',
}: {
  id: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  otherPlaceholder?: string;
}) {
  const listed = options.includes(value);
  const [other, setOther] = useState(Boolean(value) && !listed);
  // A value loaded from the record that is not on the list is an "Others".
  useEffect(() => {
    if (value && !options.includes(value)) setOther(true);
  }, [value, options]);

  return (
    <div className="space-y-2">
      <Select
        id={id}
        value={other ? OTHERS : listed ? value : ''}
        onChange={(e) => {
          if (e.target.value === OTHERS) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHERS}>Others (please specify)</option>
      </Select>
      {other ? (
        <TextInput
          aria-label={otherPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
        />
      ) : null}
    </div>
  );
}
