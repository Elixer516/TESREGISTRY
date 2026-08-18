import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StudentStatus } from '@/types';
import { studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
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
import { AddStudentModal } from './AddStudentModal';
import { ImportStudentsModal } from './ImportStudentsModal';
import { ApproveStudentModal } from './ApproveStudentModal';
import { RejectStudentModal } from './RejectStudentModal';
import { EditStudentModal } from './EditStudentModal';

type TabValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

/** Which student statuses each tab covers. */
const TAB_STATUSES: Record<TabValue, StudentStatus[] | undefined> = {
  PENDING: ['PENDING'],
  APPROVED: ['APPROVED', 'ACTIVE', 'INACTIVE', 'GRADUATED', 'DROPPED'],
  REJECTED: ['REJECTED'],
  ALL: undefined,
};

export function StudentsPage() {
  const [tab, setTab] = useState<TabValue>('PENDING');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [approving, setApproving] = useState<StudentView | null>(null);
  const [rejecting, setRejecting] = useState<StudentView | null>(null);
  const [editing, setEditing] = useState<StudentView | null>(null);

  const all = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.list({}),
  });

  const rows = all.data ?? [];

  const counts = useMemo(
    () => ({
      PENDING: rows.filter((row) => row.status === 'PENDING').length,
      APPROVED: rows.filter((row) => TAB_STATUSES.APPROVED?.includes(row.status)).length,
      REJECTED: rows.filter((row) => row.status === 'REJECTED').length,
      ALL: rows.length,
    }),
    [rows],
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
        isLoading={all.isLoading}
        error={all.error}
        isEmpty={visible.length === 0}
        onRetry={() => all.refetch()}
        loadingLabel="Loading student records…"
        emptyTitle={search ? 'No students match that search' : 'Nothing in this tab yet'}
        emptyHint={
          search
            ? 'Try a shorter search term, or clear the box to see the whole list.'
            : 'Add a student manually, or import a CSV exported from your enrollment sheet.'
        }
        emptyAction={
          !search ? (
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
                      <div className="flex justify-end gap-1.5">
                        {student.status === 'PENDING' ? (
                          <>
                            <Button size="sm" variant="primary" onClick={() => setApproving(student)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setRejecting(student)}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setEditing(student)}>
                            Edit
                          </Button>
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
      <ImportStudentsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ApproveStudentModal student={approving} onClose={() => setApproving(null)} />
      <RejectStudentModal student={rejecting} onClose={() => setRejecting(null)} />
      <EditStudentModal student={editing} onClose={() => setEditing(null)} />
    </>
  );
}
