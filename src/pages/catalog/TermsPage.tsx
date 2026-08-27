import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { ALL_SEMESTER_PERIODS, SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import { catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
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

/**
 * School years and semesters — Registrar-owned.
 *
 * A semester belongs to one Diploma at one year level. Several are open at
 * once by design: a diploma's Year 1, 2 and 3 cohorts run side by side, and
 * diplomas keep their own calendars. What cannot happen is two open semesters
 * for the *same* diploma and year level, since that is the pair everything
 * else resolves against.
 *
 * Creating the semester is the first step of a cycle — nothing in a diploma
 * can be enrolled until the semester it would be enrolled into exists.
 */
export function TermsPage() {
  const [yearOpen, setYearOpen] = useState(false);
  const [semesterOpen, setSemesterOpen] = useState(false);
  const [programFilter, setProgramFilter] = useState('');
  const [yearForm, setYearForm] = useState({ label: '', startDate: '', endDate: '' });
  const [semesterForm, setSemesterForm] = useState({
    academicYearId: '',
    programId: '',
    yearLevel: 1,
    semesterPeriod: 'FIRST' as SemesterPeriod,
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => catalogApi.listSemesters(),
  });
  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => catalogApi.listAcademicYears(),
  });
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['semesters'] });
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    queryClient.invalidateQueries({ queryKey: ['active-semesters'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createYear = useMutation({
    mutationFn: () => catalogApi.createAcademicYear(yearForm),
    onSuccess: (year) => {
      refresh();
      toast.success(
        `School year ${year.label} created.`,
        'Add its semesters per diploma — none are created automatically.',
      );
      setYearOpen(false);
      setYearForm({ label: '', startDate: '', endDate: '' });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const createSemester = useMutation({
    mutationFn: () => catalogApi.createSemester(semesterForm),
    onSuccess: (semester) => {
      refresh();
      toast.success(`${semester.label} created.`, 'Open it when enrollment starts.');
      setSemesterOpen(false);
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

  const allRows = semesters.data ?? [];
  const rows = useMemo(
    () => (programFilter ? allRows.filter((r) => r.programId === programFilter) : allRows),
    [allRows, programFilter],
  );
  const openCount = allRows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        title="School Years & Semesters"
        description="Each Diploma keeps its own calendar. A semester must exist and be open before anyone in that diploma can be enrolled."
        actions={
          <>
            <Button variant="secondary" onClick={() => setYearOpen(true)}>
              New school year
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                setSemesterForm((current) => ({
                  ...current,
                  academicYearId: current.academicYearId || (years.data?.[0]?.id ?? ''),
                  programId: current.programId || (programs.data?.[0]?.id ?? ''),
                }));
                setSemesterOpen(true);
              }}
            >
              New semester
            </Button>
          </>
        }
      />

      <div className="mb-4">
        {openCount > 0 ? (
          <InfoNote tone="success" title={`${openCount} semester${openCount === 1 ? '' : 's'} open`}>
            Several run at once by design — one per diploma and year level. Opening a semester
            closes any other for the same diploma and year level.
          </InfoNote>
        ) : (
          <InfoNote tone="warning" title="Nothing is open">
            No enrollment or grading can happen until a semester is opened below.
          </InfoNote>
        )}
      </div>

      <div className="mb-4 max-w-xs">
        <Field label="Filter by Diploma" htmlFor="term-prog">
          <Select
            id="term-prog"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
          >
            <option value="">All diplomas and courses</option>
            {(programs.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.code} — {program.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <QueryState
        isLoading={semesters.isLoading}
        error={semesters.error}
        isEmpty={rows.length === 0}
        onRetry={() => semesters.refetch()}
        emptyTitle={programFilter ? 'No semesters for that diploma' : 'No semesters yet'}
        emptyHint="Create a school year first, then add a semester for each diploma and year level."
      >
        <Card>
          <CardHeader title="Semesters" description="Newest school year first, then by diploma." />
          <TableWrap>
            <Table className="min-w-[48rem]">
              <thead>
                <tr>
                  <Th>Diploma</Th>
                  <Th>Year &amp; Semester</Th>
                  <Th>School year</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2">
                    <Td className="font-medium text-ink-900">{row.programCode}</Td>
                    <Td>{row.termLabel}</Td>
                    <Td>{row.academicYearLabel}</Td>
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
                        onClick={() => activate.mutate({ id: row.id, isActive: !row.isActive })}
                      >
                        {row.isActive ? 'Close' : 'Open'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      {/* ---- New school year ---- */}
      <Modal
        open={yearOpen}
        onClose={() => setYearOpen(false)}
        title="New school year"
        description="A container only. Its semesters are added per diploma afterwards."
        footer={
          <>
            <Button variant="secondary" onClick={() => setYearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createYear.isPending}
              onClick={() => {
                setError(null);
                createYear.mutate();
              }}
            >
              Create school year
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Label" htmlFor="ay-label" required hint="Format: YYYY-YYYY">
            <TextInput
              id="ay-label"
              value={yearForm.label}
              onChange={(e) => setYearForm({ ...yearForm, label: e.target.value })}
              placeholder="2027-2028"
            />
          </Field>
          <Field label="Starts" htmlFor="ay-start">
            <TextInput
              id="ay-start"
              type="date"
              value={yearForm.startDate}
              onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
            />
          </Field>
          <Field label="Ends" htmlFor="ay-end">
            <TextInput
              id="ay-end"
              type="date"
              value={yearForm.endDate}
              onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
            />
          </Field>
        </div>
        {error ? (
          <div className="mt-4">
            <InfoNote tone="danger">{error}</InfoNote>
          </div>
        ) : null}
      </Modal>

      {/* ---- New semester ---- */}
      <Modal
        open={semesterOpen}
        onClose={() => setSemesterOpen(false)}
        title="New semester"
        description="One Diploma, one year level, one half of the year — with its own dates."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSemesterOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createSemester.isPending}
              onClick={() => {
                setError(null);
                createSemester.mutate();
              }}
            >
              Create semester
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School year" htmlFor="sem-ay" required>
            <Select
              id="sem-ay"
              value={semesterForm.academicYearId}
              onChange={(e) =>
                setSemesterForm({ ...semesterForm, academicYearId: e.target.value })
              }
            >
              {(years.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Diploma" htmlFor="sem-prog" required>
            <Select
              id="sem-prog"
              value={semesterForm.programId}
              onChange={(e) => setSemesterForm({ ...semesterForm, programId: e.target.value })}
            >
              {(programs.data ?? []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} — {program.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year level" htmlFor="sem-year" required>
            <Select
              id="sem-year"
              value={semesterForm.yearLevel}
              onChange={(e) =>
                setSemesterForm({ ...semesterForm, yearLevel: Number(e.target.value) })
              }
            >
              {[1, 2, 3].map((level) => (
                <option key={level} value={level}>
                  {yearLevelLabel(level)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semester" htmlFor="sem-period" required>
            <Select
              id="sem-period"
              value={semesterForm.semesterPeriod}
              onChange={(e) =>
                setSemesterForm({
                  ...semesterForm,
                  semesterPeriod: e.target.value as SemesterPeriod,
                })
              }
            >
              {ALL_SEMESTER_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {SEMESTER_PERIOD_LABELS[period]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starts" htmlFor="sem-start" required>
            <TextInput
              id="sem-start"
              type="date"
              value={semesterForm.startDate}
              onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
            />
          </Field>
          <Field label="Ends" htmlFor="sem-end" required>
            <TextInput
              id="sem-end"
              type="date"
              value={semesterForm.endDate}
              onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
            />
          </Field>
        </div>
        {error ? (
          <div className="mt-4">
            <InfoNote tone="danger">{error}</InfoNote>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
