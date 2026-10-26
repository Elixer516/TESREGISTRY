import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentStatus } from '@/types';
import { APPLICANT_STANDING_LABELS, STUDENT_STATUS_LABELS, isInstitutionInitiated, yearLevelLabel } from '@/types';
import { studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  PageHeader,
  Table,
  TableWrap,
  Tabs,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { scholarshipFromText, scholarshipSpec } from '@/lib/scholarships';
import { StudentStatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AddStudentModal } from './AddStudentModal';
import { ImportStudentsModal } from './ImportStudentsModal';
import { ReviewImportedStudentsModal } from './ReviewImportedStudentsModal';
import { ApproveStudentModal } from './ApproveStudentModal';
import { RejectStudentModal } from './RejectStudentModal';
import { StudentDetailModal } from './StudentDetailModal';
import { AcademicStandingPanel } from './AcademicStandingPanel';

type TabValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' | 'ARCHIVED';

/** Which student statuses each tab covers. */
const TAB_STATUSES: Record<TabValue, StudentStatus[] | undefined> = {
  PENDING: ['PENDING'],
  APPROVED: ['APPROVED', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'DROPPED'],
  REJECTED: ['REJECTED'],
  ALL: undefined,
  ARCHIVED: undefined,
};

export function StudentsPage() {
  const [tab, setTab] = useState<TabValue>('PENDING');
  const [search, setSearch] = useState('');
  /**
   * Narrows within a tab rather than beside it.
   *
   * The Approved tab covers five statuses at once — approved, active,
   * inactive, graduated and dropped — because they are all "not pending and
   * not rejected". Splitting it into five more tabs would make nine; the
   * filter panel narrows inside the tab instead, by status and by everything
   * else the Registrar sorts trainees by. Transferee is the intake flag, not
   * a status, so it sits in its own group.
   */
  const [filters, setFilters] = useState<FilterSelection>({});
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reviewing, setReviewing] = useState<StudentView[]>([]);
  const [approving, setApproving] = useState<StudentView | null>(null);
  const [rejecting, setRejecting] = useState<StudentView | null>(null);
  const [viewing, setViewing] = useState<StudentView | null>(null);
  const [archiving, setArchiving] = useState<StudentView | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  /**
   * Refetch the lists in place.
   *
   * An application submitted in another tab reaches this one on its own, but
   * only while this tab is open to receive it. Coming back to a tab that was
   * already sitting here, or demonstrating a submission and turning straight
   * round to the registrar's screen, wants a button that says plainly that it
   * went and looked again.
   *
   * It refetches the existing queries rather than adding a second way to load
   * students, so the tab, the search box and the scroll position all survive.
   */
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['students'] });
    } finally {
      setRefreshing(false);
    }
  }

  const all = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.list({}),
    // Always fresh on mount, overriding the app's default 10s staleTime.
    // Pending exists specifically to catch new public applications, and a
    // registrar switching back to this tab after even a few seconds should
    // never be looking at a table that is quietly out of date.
    staleTime: 0,
  });
  const archived = useQuery({
    queryKey: ['students', 'archived'],
    queryFn: () => studentsApi.list({ includeArchived: true }),
    enabled: tab === 'ARCHIVED',
    staleTime: 0,
  });

  const rows = tab === 'ARCHIVED' ? archived.data ?? [] : all.data ?? [];

  const counts = useMemo(
    () => ({
      PENDING: (all.data ?? []).filter((row) => row.status === 'PENDING').length,
      APPROVED: (all.data ?? []).filter((row) => TAB_STATUSES.APPROVED?.includes(row.status)).length,
      REJECTED: (all.data ?? []).filter((row) => row.status === 'REJECTED').length,
      ALL: (all.data ?? []).length,
      ARCHIVED: (archived.data ?? []).length,
    }),
    [all.data, archived.data],
  );

  /**
   * Where the cohort actually stands, counted from the records themselves.
   *
   * Continuing / stopped / completed is the whole of what this dataset can
   * honestly say about retention — it is the statuses that exist, not a new
   * vocabulary invented to look like a statistics module.
   */
  const progress = useMemo(() => {
    const roll = (all.data ?? []).filter(
      (row) => row.status !== 'PENDING' && row.status !== 'REJECTED',
    );
    const by = (status: StudentStatus) => roll.filter((row) => row.status === status).length;
    return {
      onRoll: roll.length,
      continuing: by('ACTIVE'),
      awaitingEnrolment: by('APPROVED'),
      inactive: by('INACTIVE'),
      dropped: by('DROPPED'),
      graduated: by('GRADUATED'),
      transferees: roll.filter((row) => row.isTransferee).length,
      // The split the reason field was added for: a trainee the centre
      // removed is an academic outcome, a trainee who left is attrition.
      // One number for both answers neither question.
      // Truthiness, not `!== null`: a record persisted before this field
      // existed carries `undefined`, and a strict null check would file it
      // under "left of their own accord" — inventing a fact about somebody.
      removed: roll.filter(
        (row) =>
          row.status === 'DROPPED' &&
          Boolean(row.departureReason) &&
          isInstitutionInitiated(row.departureReason!),
      ).length,
      left: roll.filter(
        (row) =>
          row.status === 'DROPPED' &&
          Boolean(row.departureReason) &&
          !isInstitutionInitiated(row.departureReason!),
      ).length,
      // Dropped before the reason field existed. Named rather than hidden,
      // so the figures add up and the gap is visibly a gap.
      unrecorded: roll.filter(
        (row) => row.status === 'DROPPED' && !row.departureReason,
      ).length,
    };
  }, [all.data]);

  const inTab = useMemo(() => {
    const statuses = TAB_STATUSES[tab];
    return rows.filter((row) => (statuses ? statuses.includes(row.status) : true));
  }, [rows, tab]);

  /** Chips for what the trainees on this tab actually have, so none matches nobody. */
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const distinct = <T,>(values: T[]) => [...new Set(values)];
    const statusOrder: StudentStatus[] = ['PENDING', 'ACTIVE', 'APPROVED', 'INACTIVE', 'DROPPED', 'GRADUATED', 'REJECTED'];
    const statusWording: Partial<Record<StudentStatus, string>> = {
      ACTIVE: `${STUDENT_STATUS_LABELS.ACTIVE} — continuing`,
      APPROVED: `${STUDENT_STATUS_LABELS.APPROVED} — not yet enrolled`,
    };
    const statuses = distinct(inTab.map((r) => r.status));
    const programs = distinct(inTab.map((r) => r.programCode)).sort();
    const years = distinct(inTab.map((r) => r.yearLevel)).sort((a, b) => a - b);
    const sections = distinct(inTab.map((r) => r.sectionCode).filter((c): c is string => !!c)).sort();
    const standings = distinct(inTab.map((r) => r.applicantStanding).filter((s) => !!s)) as Array<keyof typeof APPLICANT_STANDING_LABELS>;
    const scholarships = distinct(inTab.map((r) => scholarshipFromText(r.scholarshipType)));
    return [
      {
        key: 'status',
        label: 'status',
        chips: statuses.length > 1
          ? statusOrder.filter((st) => statuses.includes(st)).map((st) => ({ value: st, label: statusWording[st] ?? STUDENT_STATUS_LABELS[st] }))
          : [],
      },
      {
        key: 'program',
        label: 'diploma',
        chips: programs.map((code) => ({ value: code, label: code, title: inTab.find((r) => r.programCode === code)?.programName })),
      },
      { key: 'year', label: 'year level', chips: years.map((y) => ({ value: String(y), label: yearLevelLabel(y) })) },
      { key: 'section', label: 'section', chips: sections.map((c) => ({ value: c, label: c })) },
      {
        key: 'intake',
        label: 'intake',
        chips: [
          { value: 'NEW', label: 'New trainee' },
          { value: 'TRANSFEREE', label: 'Transferee' },
        ],
      },
      {
        key: 'standing',
        label: 'educational attainment',
        chips: standings.map((st) => ({ value: st, label: APPLICANT_STANDING_LABELS[st] })),
      },
      {
        key: 'scholarship',
        label: 'scholarship',
        chips: scholarships.map((code) => ({ value: code, label: scholarshipSpec(code).label, title: scholarshipSpec(code).name })),
      },
      { key: 'sex', label: 'sex', chips: [{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }] },
    ];
  }, [inTab]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // A choice in a group this tab does not show (status, on Pending) is ignored, not applied blind.
    const shown = new Set(filterGroups.filter((g) => g.chips.length > 0).map((g) => g.key));
    const active = Object.fromEntries(Object.entries(filters).filter(([key]) => shown.has(key)));
    return inTab
      .filter((row) =>
        matchesSelection(active, (key) => {
          switch (key) {
            case 'status': return row.status;
            case 'program': return row.programCode;
            case 'year': return String(row.yearLevel);
            case 'section': return row.sectionCode;
            case 'intake': return row.isTransferee ? 'TRANSFEREE' : 'NEW';
            case 'standing': return row.applicantStanding;
            case 'scholarship': return scholarshipFromText(row.scholarshipType);
            case 'sex': return row.sex;
            default: return null;
          }
        }),
      )
      .filter((row) =>
        needle
          ? (row.fullName + ' ' + row.lastFirstName + ' ' + row.studentNumber)
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [inTab, filterGroups, search, filters]);

  const archive = useMutation({
    mutationFn: (password: string) => studentsApi.archive(archiving?.id ?? '', password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Student archived.', 'It is hidden from the default lists but nothing was deleted.');
      setArchiving(null);
    },
    onError: (caught) => {
      setArchiving(null);
      toast.error('Could not archive that student.', errorMessage(caught));
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => studentsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Student restored.');
    },
    onError: (caught) => toast.error('Could not restore that student.', errorMessage(caught)),
  });

  return (
    <>
      <PageHeader
        title="Students"
        description="Applications, approvals and student records. Approving an application is what assigns the curriculum."
        actions={
          <>
            <Button
              variant="secondary"
              loading={refreshing}
              onClick={refresh}
              title="Fetch the latest applications without leaving this page"
            >
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add student
            </Button>
          </>
        }
      />

      <AcademicStandingPanel />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs<TabValue>
          ariaLabel="Student status"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'PENDING', label: 'Pending', count: counts.PENDING },
            { value: 'APPROVED', label: 'Approved', count: counts.APPROVED },
            { value: 'REJECTED', label: 'Rejected', count: counts.REJECTED },
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'ARCHIVED', label: 'Archived', count: counts.ARCHIVED },
          ]}
        />
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or student number…"
            aria-label="Search students"
          />
        </div>

      </div>

      <FilterPanel groups={filterGroups} applied={filters} onApply={setFilters} />

      {tab === 'APPROVED' || tab === 'ALL' ? (
        <Card className="mb-4 p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-ink-500">
              On the roll · {progress.onRoll}
            </span>
            <Stat label="Continuing" value={progress.continuing} tone="text-success-ink" />
            <Stat label="Awaiting enrolment" value={progress.awaitingEnrolment} />
            <Stat label="Inactive" value={progress.inactive} />
            <Stat label="Dropped" value={progress.dropped} tone="text-danger-ink" />
            <Stat label="↳ removed by the centre" value={progress.removed} />
            <Stat label="↳ left of their own accord" value={progress.left} />
            {progress.unrecorded > 0 ? (
              <Stat label="↳ reason not recorded" value={progress.unrecorded} />
            ) : null}
            <Stat label="Graduated" value={progress.graduated} tone="text-brand-text" />
            <Stat label="Transferees" value={progress.transferees} />
          </div>
        </Card>
      ) : null}

      <QueryState
        isLoading={tab === 'ARCHIVED' ? archived.isLoading : all.isLoading}
        error={tab === 'ARCHIVED' ? archived.error : all.error}
        isEmpty={visible.length === 0}
        onRetry={() => (tab === 'ARCHIVED' ? archived.refetch() : all.refetch())}
        loadingLabel="Loading student records…"
        emptyTitle={search ? 'No students match that search' : 'Nothing in this tab yet'}
        emptyHint={
          search
            ? 'Try a shorter search term, or clear the box to see the whole list.'
            : tab === 'ARCHIVED'
              ? 'Archived students will appear here.'
              : 'Add a student manually, or import a CSV exported from your enrollment sheet.'
        }
        emptyAction={
          !search && tab !== 'ARCHIVED' ? (
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add student
            </Button>
          ) : undefined
        }
      >
        <Card>
          <TableWrap>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Student No.</Th>
                  <Th>Program</Th>
                  <Th>Year</Th>
                  <Th>Section</Th>
                  <Th>Curriculum</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((student) => (
                  <tr key={student.id} className="hover:bg-surface-2">
                    <Td>
                      <span className="block font-medium text-ink-900">
                        {student.lastFirstName}
                      </span>
                      <span className="block text-xs text-ink-500">{student.email || '—'}</span>
                      {student.isTransferee ? (
                        <span className="mt-0.5 inline-block text-[11px] font-semibold text-brand-text">
                          Transferee
                        </span>
                      ) : null}
                    </Td>
                    <Td className="tabular-nums">{student.studentNumber}</Td>
                    <Td>{student.programCode}</Td>
                    <Td className="tabular-nums">{student.yearLevel}</Td>
                    <Td>{student.sectionCode ?? '—'}</Td>
                    <Td className="text-xs">{student.curriculumName ?? '—'}</Td>
                    <Td>
                      <StudentStatusBadge status={student.status} />
                      {student.rejectionReason ? (
                        <span className="mt-1 block max-w-[16rem] text-[11px] text-ink-500">
                          {student.rejectionReason}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {/*
                          Available on every row, Pending included — a
                          registrar should be able to read an application,
                          and file its documents, before ruling on it.
                        */}
                        {tab !== 'ARCHIVED' ? (
                          <Button size="sm" variant="secondary" onClick={() => setViewing(student)}>
                            View
                          </Button>
                        ) : null}
                        {tab === 'ARCHIVED' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={restore.isPending}
                            onClick={() => restore.mutate(student.id)}
                          >
                            Restore
                          </Button>
                        ) : student.status === 'PENDING' ? (
                          <>
                            {/*
                              Edit lives inside View, where the registrar is
                              already reading the application they need to
                              correct — an online application is typed by the
                              applicant, and the name becomes their Drive
                              folder and prints on every generated document.
                            */}
                            <Button size="sm" variant="primary" onClick={() => setApproving(student)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setRejecting(student)}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            {/*
                              Edit moved inside View in V9 — the registrar is
                              almost always reading the record when they find
                              something to correct.
                            */}
                            <Button size="sm" variant="danger" onClick={() => setArchiving(student)}>
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={setReviewing}
      />
      <ReviewImportedStudentsModal students={reviewing} onClose={() => setReviewing([])} />
      <ApproveStudentModal student={approving} onClose={() => setApproving(null)} />
      <RejectStudentModal student={rejecting} onClose={() => setRejecting(null)} />
      <StudentDetailModal
        student={viewing}
        onClose={() => setViewing(null)}
        onApprove={(picked) => {
          setViewing(null);
          setApproving(picked);
        }}
      />

      <ConfirmDialog
        open={archiving !== null}
        title={archiving ? 'Delete ' + archiving.fullName + '?' : 'Delete student?'}
        message="This archives the record — it is hidden from the default lists, but enrollments, grades and documents are kept and can be restored."
        confirmLabel="Delete"
        requirePassword
        loading={archive.isPending}
        onConfirm={(password) => archive.mutate(password)}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}

/** One figure in the standing summary. Muted when there is nothing to report. */
function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`font-semibold tabular-nums ${value === 0 ? 'text-ink-400' : (tone ?? 'text-ink-900')}`}>
        {value}
      </span>
      <span className="text-ink-500">{label}</span>
    </span>
  );
}
