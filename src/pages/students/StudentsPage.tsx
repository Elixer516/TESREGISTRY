import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentStatus } from '@/types';
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
import { StudentStatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AddStudentModal } from './AddStudentModal';
import { ImportStudentsModal } from './ImportStudentsModal';
import { ReviewImportedStudentsModal } from './ReviewImportedStudentsModal';
import { ApproveStudentModal } from './ApproveStudentModal';
import { RejectStudentModal } from './RejectStudentModal';
import { StudentDetailModal } from './StudentDetailModal';

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
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reviewing, setReviewing] = useState<StudentView[]>([]);
  const [approving, setApproving] = useState<StudentView | null>(null);
  const [rejecting, setRejecting] = useState<StudentView | null>(null);
  const [viewing, setViewing] = useState<StudentView | null>(null);
  const [archiving, setArchiving] = useState<StudentView | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const all = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.list({}),
  });
  const archived = useQuery({
    queryKey: ['students', 'archived'],
    queryFn: () => studentsApi.list({ includeArchived: true }),
    enabled: tab === 'ARCHIVED',
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

  const visible = useMemo(() => {
    const statuses = TAB_STATUSES[tab];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => (statuses ? statuses.includes(row.status) : true))
      .filter((row) =>
        needle
          ? (row.fullName + ' ' + row.lastFirstName + ' ' + row.studentNumber)
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [rows, tab, search]);

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
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              Add student
            </Button>
          </>
        }
      />

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
