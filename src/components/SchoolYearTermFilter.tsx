import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import type { SemesterView } from '@/types/views';
import { Field, Select } from './ui';

/**
 * School Year → Term selector shared by the grades, records and schedule
 * screens. It resolves to a single semester id, because everything downstream
 * is keyed on the term, not the year.
 */
export function SchoolYearTermFilter({
  semesterId,
  onChange,
  label = 'Term',
  includeAllTerms = false,
  className,
}: {
  semesterId: string | null;
  onChange: (semesterId: string | null) => void;
  label?: string;
  includeAllTerms?: boolean;
  className?: string;
}) {
  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => catalogApi.listAcademicYears(),
  });
  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => catalogApi.listSemesters(),
  });

  const rows: SemesterView[] = semesters.data ?? [];
  const current = rows.find((row) => row.id === semesterId);
  const yearId = current?.academicYearId ?? years.data?.[0]?.id ?? '';
  const termsForYear = rows.filter((row) => row.academicYearId === yearId);

  return (
    <div className={className ?? 'grid gap-3 sm:grid-cols-2'}>
      <Field label="School Year" htmlFor="filter-year">
        <Select
          id="filter-year"
          value={yearId}
          onChange={(event) => {
            const first = rows.find((row) => row.academicYearId === event.target.value);
            onChange(first?.id ?? null);
          }}
        >
          {(years.data ?? []).map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
              {year.isActive ? ' (active)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={label} htmlFor="filter-term">
        <Select
          id="filter-term"
          value={semesterId ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        >
          {includeAllTerms ? <option value="">All terms</option> : null}
          {termsForYear.map((term) => (
            <option key={term.id} value={term.id}>
              {term.termLabel}
              {term.isActive ? ' (active)' : ''}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
