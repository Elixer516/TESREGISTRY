import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import type { SemesterView } from '@/types/views';
import { Field, Select } from './ui';

/**
 * School Year → Diploma → Semester selector, shared by the schedule and
 * enrollment screens. It resolves to a single semester id, because
 * everything downstream — the class list, the roster — is keyed on one
 * semester, not a year.
 *
 * The Diploma tier exists because V9 made a semester belong to one Diploma
 * and year level rather than the whole centre. Without it, this dropdown
 * listed all 48 of a school year's semesters flat — eight diplomas' "First
 * Year, 1st Semester" indistinguishable from one another — which read as
 * most subjects having no schedule at all, when every one of them did.
 */
export function SchoolYearTermFilter({
  semesterId,
  onChange,
  label = 'Semester',
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
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const rows: SemesterView[] = semesters.data ?? [];
  const current = rows.find((row) => row.id === semesterId);
  const yearId = current?.academicYearId ?? years.data?.[0]?.id ?? '';
  const programId = current?.programId ?? programs.data?.[0]?.id ?? '';

  const termsForSelection = rows.filter(
    (row) => row.academicYearId === yearId && row.programId === programId,
  );

  /** The open semester for the pair if there is one, else the first. */
  function firstSemesterFor(nextYearId: string, nextProgramId: string): string | null {
    const options = rows.filter(
      (row) => row.academicYearId === nextYearId && row.programId === nextProgramId,
    );
    return (options.find((row) => row.isActive) ?? options[0])?.id ?? null;
  }

  return (
    <div className={className ?? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
      <Field label="School Year" htmlFor="filter-year">
        <Select
          id="filter-year"
          value={yearId}
          onChange={(event) => onChange(firstSemesterFor(event.target.value, programId))}
        >
          {(years.data ?? []).map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
              {year.isActive ? ' (active)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Diploma" htmlFor="filter-program">
        <Select
          id="filter-program"
          value={programId}
          onChange={(event) => onChange(firstSemesterFor(yearId, event.target.value))}
        >
          {(programs.data ?? []).map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} — {program.name}
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
          {termsForSelection.map((term) => (
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
