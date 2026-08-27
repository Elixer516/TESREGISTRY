import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { ALL_SEMESTER_PERIODS, SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import { catalogApi, recordsApi } from '@/api';
import type {
  EnrollmentSubjectView,
  GradeCompletionView,
  StudentView,
  TermRecordGroup,
} from '@/types/views';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker } from '@/components/pickers';
import { GradeEvaluationModal } from './GradeEvaluationModal';
import { GradeStatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/format';
import { IncResolutionModal } from './IncResolutionModal';
import { GradeSheetModal } from './GradeSheetModal';

/**
 * Academic records — the whole history, grouped by term.
 *
 * An unresolved INC drives the term GWA to 0.000 on purpose. It is a signal
 * that the average cannot be trusted yet, not an arithmetic slip.
 */
export function AcademicRecordsPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [evaluationFor, setEvaluationFor] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearId, setYearId] = useState<string>('');
  const [semesterPeriod, setSemesterPeriod] = useState<SemesterPeriod | 'ALL'>('ALL');
  const [yearLevel, setYearLevel] = useState<number | 'ALL'>('ALL');
  const [incRow, setIncRow] = useState<EnrollmentSubjectView | null>(null);
  const [sheetSemesterId, setSheetSemesterId] = useState<string | null>(null);

  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => catalogApi.listAcademicYears(),
  });

  const record = useQuery({
    queryKey: ['academic-record', student?.id, yearId, semesterPeriod, yearLevel],
    queryFn: () =>
      recordsApi.get(student?.id ?? '', {
        academicYearId: yearId || undefined,
        semesterPeriod,
        yearLevel,
      }),
    enabled: Boolean(student),
  });

  return (
    <>
      <PageHeader
        title="Academic Records"
        description="Grades grouped by term, with the two INC exits kept separate: a completion keeps the INC on the record, a correction removes it."
        actions={
          student ? (
            <Button variant="primary" onClick={() => setEvaluationFor(student)}>
              Grade Evaluation Form
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-4">
          <div className="space-y-4">
            <PickerButton
              label="Student"
              value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
              placeholder="Choose a student…"
              onClick={() => setPickerOpen(true)}
              onClear={() => setStudent(null)}
            />
            <Field label="School Year" htmlFor="rec-year">
              <Select id="rec-year" value={yearId} onChange={(e) => setYearId(e.target.value)}>
                <option value="">All school years</option>
                {(years.data ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Semester" htmlFor="rec-semester">
              <Select
                id="rec-semester"
                value={semesterPeriod}
                onChange={(e) => setSemesterPeriod(e.target.value as SemesterPeriod | 'ALL')}
              >
                <option value="ALL">Both semesters</option>
                {ALL_SEMESTER_PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {SEMESTER_PERIOD_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year level" htmlFor="rec-year-level">
              <Select
                id="rec-year-level"
                value={yearLevel}
                onChange={(e) =>
                  setYearLevel(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
              >
                <option value="ALL">All year levels</option>
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {yearLevelLabel(value)}
                  </option>
                ))}
              </Select>
            </Field>

            {record.data ? (
              <dl className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Total units</dt>
                  <dd className="font-medium tabular-nums text-ink-900">{record.data.totalUnits}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Overall GWA</dt>
                  <dd className="font-medium tabular-nums text-ink-900">{record.data.overallGwa}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a student"
              hint="Search by name or student number to see their full academic history."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a student
                </Button>
              }
            />
          ) : record.isLoading ? (
            <LoadingState label="Loading academic history…" />
          ) : record.error ? (
            <ErrorState error={record.error} onRetry={() => record.refetch()} />
          ) : record.data && record.data.groups.length === 0 ? (
            <EmptyState
              title="No enrollment records"
              hint="This student has no enrollments matching the filters. Clear the filters, or enroll them into a term first."
            />
          ) : record.data ? (
            <RecordBody
              groups={record.data.groups}
              completions={record.data.completions}
              hasUnresolvedInc={record.data.hasUnresolvedInc}
              onResolveInc={setIncRow}
              onPrintSheet={setSheetSemesterId}
            />
          ) : null}
        </div>
      </div>

      <GradeEvaluationModal student={evaluationFor} onClose={() => setEvaluationFor(null)} />

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />

      <IncResolutionModal row={incRow} onClose={() => setIncRow(null)} />

      <GradeSheetModal
        studentId={student?.id ?? null}
        semesterId={sheetSemesterId}
        onClose={() => setSheetSemesterId(null)}
      />
    </>
  );
}

function RecordBody({
  groups,
  completions,
  hasUnresolvedInc,
  onResolveInc,
  onPrintSheet,
}: {
  groups: TermRecordGroup[];
  completions: GradeCompletionView[];
  hasUnresolvedInc: boolean;
  onResolveInc: (row: EnrollmentSubjectView) => void;
  onPrintSheet: (semesterId: string) => void;
}) {
  return (
    <>
      {hasUnresolvedInc ? (
        <InfoNote tone="warning" title="This record contains an unresolved INC">
          The affected term reports a GWA of 0.000 until the INC is completed or corrected. That
          is deliberate — an average computed around a missing grade would be misleading.
        </InfoNote>
      ) : null}

      {groups.map((group) => (
        <Card key={group.enrollmentId}>
          <CardHeader
            title={group.academicYearLabel + ' · ' + group.termLabel}
            description={
              group.totalUnits + ' units · GWA ' + group.gwa + (group.hasUnresolvedInc ? ' (unresolved INC)' : '')
            }
            actions={
              <>
                <Badge tone={group.status === 'DROPPED' ? 'danger' : 'neutral'}>
                  {group.status}
                </Badge>
                <Button size="sm" variant="secondary" onClick={() => onPrintSheet(group.semesterId)}>
                  Grade sheet
                </Button>
              </>
            }
          />
          {group.rows.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">
              This enrollment has no subject rows.
            </p>
          ) : (
            <TableWrap>
              <Table className="min-w-[46rem]">
                <thead>
                  <tr>
                    <Th>Subject</Th>
                    <Th className="text-right">Units</Th>
                    <Th>Final grade</Th>
                    <Th>Completion</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <span className="block font-medium text-ink-900">{row.subjectCode}</span>
                        <span className="block text-xs text-ink-500">{row.subjectTitle}</span>
                      </Td>
                      <Td className="text-right tabular-nums">{row.units}</Td>
                      <Td className="tabular-nums font-medium text-ink-900">
                        {row.finalGrade ?? '—'}
                      </Td>
                      <Td className="tabular-nums">{row.completionGrade ?? '—'}</Td>
                      <Td>
                        <GradeStatusBadge status={row.gradeStatus} />
                      </Td>
                      <Td className="text-right">
                        {row.finalGrade === 'INC' && !row.completionGrade ? (
                          <Button size="sm" variant="primary" onClick={() => onResolveInc(row)}>
                            Resolve INC
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      ))}

      {completions.length > 0 ? (
        <Card>
          <CardHeader
            title="INC history"
            description="Every completion and correction, with the values before and after."
          />
          <ul className="divide-y divide-line">
            {completions.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={entry.kind === 'COMPLETION' ? 'info' : 'warning'}>
                    {entry.kind === 'COMPLETION' ? 'Completion' : 'Correction'}
                  </Badge>
                  <span className="text-sm font-medium text-ink-900">{entry.subjectCode}</span>
                  <span className="text-xs text-ink-400">{formatDateTime(entry.processedAt)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-700">
                  {entry.kind === 'COMPLETION'
                    ? 'Final grade stayed INC; completion grade ' + (entry.newCompletionGrade ?? '—') + ' recorded.'
                    : 'Final grade replaced: ' +
                      (entry.previousFinalGrade ?? '—') +
                      ' → ' +
                      (entry.newFinalGrade ?? '—') +
                      '.'}
                </p>
                {entry.remarks ? (
                  <p className="mt-0.5 text-xs text-ink-500">{entry.remarks}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-ink-400">Processed by {entry.processedByName}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
