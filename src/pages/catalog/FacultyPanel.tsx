import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schedulesApi, auditApi } from '@/api';
import type { ClassScheduleView } from '@/types/views';
import { Badge, Button, Card, CardHeader, TableWrap, Table, Td, Th } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/states';
import { ImportFacultyScheduleModal } from './ImportFacultyScheduleModal';

/**
 * Faculty (trainors) — read-only here, on purpose. The Faculty & Schedule
 * import is the intake path; a trainor's row in that file is both their
 * contact record and the classes they teach, so there is nothing left to
 * hand-build once it's imported.
 */
export function FacultyPanel() {
  const [importOpen, setImportOpen] = useState(false);

  const faculty = useQuery({
    queryKey: ['faculty', 'all'],
    queryFn: () => auditApi.listFaculty(''),
  });
  const schedules = useQuery({
    queryKey: ['schedules', 'all-for-faculty'],
    queryFn: () => schedulesApi.list({ status: 'PUBLISHED' }),
  });

  const schedulesByFaculty = useMemo(() => {
    const map = new Map<string, ClassScheduleView[]>();
    for (const schedule of schedules.data ?? []) {
      if (!schedule.facultyId) continue;
      const list = map.get(schedule.facultyId) ?? [];
      list.push(schedule);
      map.set(schedule.facultyId, list);
    }
    return map;
  }, [schedules.data]);

  const rows = faculty.data ?? [];

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-700">
            Trainors and their published classes, all sourced from the Faculty &amp; Schedule
            import — re-upload a revised file to update either.
          </p>
          <Button variant="primary" onClick={() => setImportOpen(true)}>
            Import faculty &amp; schedules
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Faculty" description={rows.length + ' trainor(s) on record.'} />
        {faculty.isLoading ? (
          <div className="p-4">
            <LoadingState label="Loading faculty…" rows={3} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No faculty yet"
              hint="Import a Faculty & Schedule file to add trainors and their classes together."
              icon="🧑‍🏫"
              action={
                <Button variant="primary" onClick={() => setImportOpen(true)}>
                  Import faculty &amp; schedules
                </Button>
              }
            />
          </div>
        ) : (
          <TableWrap>
            <Table className="min-w-[46rem]">
              <thead>
                <tr>
                  <Th>Employee ID</Th>
                  <Th>Name</Th>
                  <Th>Diploma</Th>
                  <Th>Position</Th>
                  <Th>Teaching</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((person) => {
                  const classes = schedulesByFaculty.get(person.id) ?? [];
                  return (
                    <tr key={person.id}>
                      <Td className="tabular-nums">{person.employeeId}</Td>
                      <Td className="font-medium text-ink-900">{person.fullName}</Td>
                      <Td className="text-xs">{person.diploma || '—'}</Td>
                      <Td className="text-xs">{person.position || '—'}</Td>
                      <Td>
                        {classes.length === 0 ? (
                          <span className="text-xs text-ink-400">No published classes</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {classes.map((c) => (
                              <Badge key={c.id} tone="neutral">
                                {c.subjectCode} · {c.sectionCode}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <ImportFacultyScheduleModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
