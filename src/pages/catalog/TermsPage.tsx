import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { ALL_SEMESTER_PERIODS, SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type { SemesterView } from '@/types/views';
import { catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

const NEW_YEAR = '__new__';

/**
 * School years and semesters — Registrar-owned.
 *
 * A semester belongs to one Diploma at one year level, and several are open
 * at once by design: a diploma's Year 1, 2 and 3 cohorts run side by side,
 * and diplomas keep their own calendars. What cannot happen is two open
 * semesters for the same diploma AND year level, since that pair is what
 * everything else resolves against.
 *
 * Laid out as one collapsible section per Diploma rather than one long table.
 * Eight diplomas × three year levels × two semesters is 48 rows, which as a
 * flat list buries the thing a registrar actually wants — the state of one
 * diploma's year.
 */
export function TermsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    academicYearId: '',
    newYearLabel: '',
    newYearStart: '',
    newYearEnd: '',
    programId: '',
    yearLevel: 1,
    semesterPeriod: 'FIRST' as SemesterPeriod,
    startDate: '',
    endDate: '',
  });

  const queryClient = useQueryClient();
  const toast = useToast();

  const semesters = useQuery({ queryKey: ['semesters'], queryFn: () => catalogApi.listSemesters() });
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => catalogApi.listAcademicYears() });
  const programs = useQuery({ queryKey: ['programs'], queryFn: () => catalogApi.listPrograms() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['semesters'] });
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    queryClient.invalidateQueries({ queryKey: ['active-semesters'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  /**
   * One action, not two.
   *
   * A school year with no semesters is useless, so creating one and opening
   * its first semester is a single submission — the year is created first
   * only because the semester needs something to belong to.
   */
  const create = useMutation({
    mutationFn: async () => {
      let academicYearId = form.academicYearId;
      if (academicYearId === NEW_YEAR) {
        const year = await catalogApi.createAcademicYear({
          label: form.newYearLabel,
          startDate: form.newYearStart,
          endDate: form.newYearEnd,
        });
        academicYearId = year.id;
      }
      return catalogApi.createSemester({
        academicYearId,
        programId: form.programId,
        yearLevel: form.yearLevel,
        semesterPeriod: form.semesterPeriod,
        startDate: form.startDate,
        endDate: form.endDate,
      });
    },
    onSuccess: (semester) => {
      refresh();
      toast.success(`${semester.label} created.`, 'Open it when enrollment starts.');
      setCreateOpen(false);
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const activate = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      catalogApi.setSemesterActive(input.id, input.isActive),
    onSuccess: (rows) => {
      queryClient.setQueryData(['semesters'], rows);
      queryClient.invalidateQueries({ queryKey: ['active-semesters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Semester updated.', 'Enrollment and grading follow the open semester.');
    },
    onError: (caught) => toast.error('Could not change the semester.', errorMessage(caught)),
  });

  const rows = semesters.data ?? [];

  /** Grouped by Diploma, each diploma's semesters in curriculum order. */
  const byDiploma = useMemo(() => {
    const groups = new Map<string, { code: string; name: string; rows: SemesterView[] }>();
    for (const row of rows) {
      const group = groups.get(row.programId) ?? {
        code: row.programCode,
        name: row.programName,
        rows: [],
      };
      group.rows.push(row);
      groups.set(row.programId, group);
    }
    for (const group of groups.values()) {
      group.rows.sort(
        (a, b) =>
          a.yearLevel - b.yearLevel ||
          (a.semesterPeriod === 'FIRST' ? 0 : 1) - (b.semesterPeriod === 'FIRST' ? 0 : 1),
      );
    }
    return [...groups.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code));
  }, [rows]);

  const openCount = rows.filter((r) => r.isActive).length;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PageHeader
        title="School Years & Semesters"
        description="Each Diploma keeps its own calendar. A semester must exist and be open before anyone in that Diploma can be enrolled."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setForm((current) => ({
                ...current,
                academicYearId: current.academicYearId || (years.data?.[0]?.id ?? NEW_YEAR),
                programId: current.programId || (programs.data?.[0]?.id ?? ''),
              }));
              setCreateOpen(true);
            }}
          >
            New school year &amp; semester
          </Button>
        }
      />

      <div className="mb-4">
        {openCount > 0 ? (
          <InfoNote tone="success" title={`${openCount} semester${openCount === 1 ? '' : 's'} open`}>
            Several run at once by design — one per Diploma and year level. Opening a semester
            closes any other for that same Diploma and year level.
          </InfoNote>
        ) : (
          <InfoNote tone="warning" title="Nothing is open">
            No enrollment or grading can happen until a semester is opened below.
          </InfoNote>
        )}
      </div>

      <QueryState
        isLoading={semesters.isLoading}
        error={semesters.error}
        isEmpty={rows.length === 0}
        onRetry={() => semesters.refetch()}
        emptyTitle="No semesters yet"
        emptyHint="Create a school year and its first semester together, then add the rest per Diploma."
      >
        <div className="space-y-2">
          {byDiploma.map(([programId, group]) => {
            const isOpen = expanded === programId;
            const open = group.rows.filter((r) => r.isActive).length;
            return (
              <Card key={programId} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : programId)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className={`text-ink-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  >
                    ▸
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">
                      {group.code} — {group.name}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {group.rows.length} semester{group.rows.length === 1 ? '' : 's'} ·{' '}
                      {group.rows[0]?.academicYearLabel ?? '—'}
                    </span>
                  </span>
                  <Badge tone={open > 0 ? 'success' : 'neutral'}>
                    {open > 0 ? `${open} open` : 'None open'}
                  </Badge>
                </button>

                {isOpen ? (
                  <TableWrap>
                    <Table className="min-w-[40rem] border-t border-line">
                      <thead>
                        <tr>
                          <Th>Year &amp; Semester</Th>
                          <Th>Starts</Th>
                          <Th>Ends</Th>
                          <Th>Status</Th>
                          <Th className="text-right">Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-surface-2">
                            <Td className="font-medium text-ink-900">{row.termLabel}</Td>
                            <Td>{formatDate(row.startDate)}</Td>
                            <Td>{formatDate(row.endDate)}</Td>
                            <Td>
                              <Badge tone={row.isActive ? 'success' : 'neutral'}>
                                {row.isActive ? 'Open' : 'Closed'}
                              </Badge>
                            </Td>
                            <Td className="text-right">
                              <Button
                                size="sm"
                                variant={row.isActive ? 'secondary' : 'primary'}
                                loading={activate.isPending}
                                onClick={() =>
                                  activate.mutate({ id: row.id, isActive: !row.isActive })
                                }
                              >
                                {row.isActive ? 'Close' : 'Open'}
                              </Button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                ) : null}
              </Card>
            );
          })}
        </div>
      </QueryState>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New school year & semester"
        description="Created together — a school year with no semesters cannot be enrolled into."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="School year" htmlFor="ts-year" required>
            <Select
              id="ts-year"
              value={form.academicYearId}
              onChange={(e) => set('academicYearId', e.target.value)}
            >
              {(years.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
              <option value={NEW_YEAR}>＋ New school year…</option>
            </Select>
          </Field>

          {form.academicYearId === NEW_YEAR ? (
            <div className="grid gap-4 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-3">
              <Field label="Label" htmlFor="ts-label" required hint="Format: YYYY-YYYY">
                <TextInput
                  id="ts-label"
                  value={form.newYearLabel}
                  onChange={(e) => set('newYearLabel', e.target.value)}
                  placeholder="2027-2028"
                />
              </Field>
              <Field label="Year starts" htmlFor="ts-ystart">
                <TextInput
                  id="ts-ystart"
                  type="date"
                  value={form.newYearStart}
                  onChange={(e) => set('newYearStart', e.target.value)}
                />
              </Field>
              <Field label="Year ends" htmlFor="ts-yend">
                <TextInput
                  id="ts-yend"
                  type="date"
                  value={form.newYearEnd}
                  onChange={(e) => set('newYearEnd', e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Diploma" htmlFor="ts-prog" required>
              <Select
                id="ts-prog"
                value={form.programId}
                onChange={(e) => set('programId', e.target.value)}
              >
                {(programs.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.code} — {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year level" htmlFor="ts-level" required>
              <Select
                id="ts-level"
                value={form.yearLevel}
                onChange={(e) => set('yearLevel', Number(e.target.value))}
              >
                {[1, 2, 3].map((level) => (
                  <option key={level} value={level}>
                    {yearLevelLabel(level)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Semester" htmlFor="ts-period" required>
              <Select
                id="ts-period"
                value={form.semesterPeriod}
                onChange={(e) => set('semesterPeriod', e.target.value as SemesterPeriod)}
              >
                {ALL_SEMESTER_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {SEMESTER_PERIOD_LABELS[period]}
                  </option>
                ))}
              </Select>
            </Field>
            <div />
            <Field label="Semester starts" htmlFor="ts-start" required>
              <TextInput
                id="ts-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </Field>
            <Field label="Semester ends" htmlFor="ts-end" required>
              <TextInput
                id="ts-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </Field>
          </div>

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      </Modal>
    </>
  );
}
