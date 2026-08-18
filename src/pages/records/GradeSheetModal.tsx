import { useQuery } from '@tanstack/react-query';
import { recordsApi } from '@/api';
import { INSTITUTION } from '@/config/institution';
import { formatDate } from '@/lib/format';
import { Button, InfoNote, Modal, Table, TableWrap, Td, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';

/**
 * Printable semester grade sheet.
 *
 * The print stylesheet forces the light palette and Long Bond paper, repeats
 * the table header on every page and keeps rows whole.
 */
export function GradeSheetModal({
  studentId,
  semesterId,
  onClose,
}: {
  studentId: string | null;
  semesterId: string | null;
  onClose: () => void;
}) {
  const sheet = useQuery({
    queryKey: ['grade-sheet', studentId, semesterId],
    queryFn: () => recordsApi.gradeSheet(studentId ?? '', semesterId ?? ''),
    enabled: Boolean(studentId && semesterId),
  });

  return (
    <Modal
      open={Boolean(studentId && semesterId)}
      onClose={onClose}
      title="Semester grade sheet"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </>
      }
    >
      {sheet.isLoading ? (
        <LoadingState label="Building the grade sheet…" />
      ) : sheet.error ? (
        <ErrorState error={sheet.error} />
      ) : sheet.data ? (
        <div className="print-sheet space-y-4">
          <header className="border-b border-line pb-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
              {INSTITUTION.agency}
            </p>
            <p className="text-sm font-semibold text-ink-900">{INSTITUTION.centre}</p>
            <p className="mt-1 text-xs text-ink-500">{INSTITUTION.address}</p>
            <p className="mt-2 text-sm font-semibold text-ink-900">SEMESTER GRADE SHEET</p>
          </header>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-500">Name:</dt>
              <dd className="font-medium text-ink-900">{sheet.data.student.fullName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Student No.:</dt>
              <dd className="font-medium text-ink-900">{sheet.data.student.studentNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Program:</dt>
              <dd className="font-medium text-ink-900">{sheet.data.student.programCode}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-500">Term:</dt>
              <dd className="font-medium text-ink-900">
                {sheet.data.group.academicYearLabel} · {sheet.data.group.termLabel}
              </dd>
            </div>
          </dl>

          <TableWrap>
            <Table className="min-w-[34rem]">
              <thead>
                <tr>
                  <Th>Course code</Th>
                  <Th>Descriptive title</Th>
                  <Th className="text-right">Units</Th>
                  <Th className="text-right">Grade</Th>
                  <Th>Remarks</Th>
                </tr>
              </thead>
              <tbody>
                {sheet.data.group.rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium text-ink-900">{row.subjectCode}</Td>
                    <Td>{row.subjectTitle}</Td>
                    <Td className="text-right tabular-nums">{row.units}</Td>
                    <Td className="text-right tabular-nums">{row.finalGrade ?? '—'}</Td>
                    <Td className="text-xs">{row.remarks}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td className="font-semibold text-ink-900">Total</Td>
                  <Td> </Td>
                  <Td className="text-right font-semibold tabular-nums text-ink-900">
                    {sheet.data.group.totalUnits}
                  </Td>
                  <Td className="text-right font-semibold tabular-nums text-ink-900">
                    GWA {sheet.data.group.gwa}
                  </Td>
                  <Td> </Td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>

          {sheet.data.gwaNote ? (
            <InfoNote tone="warning" title="About this GWA">
              {sheet.data.gwaNote}
            </InfoNote>
          ) : null}

          <div className="grid grid-cols-2 gap-8 pt-8 text-xs">
            <div className="border-t border-line pt-1 text-center text-ink-500">
              Registrar
            </div>
            <div className="border-t border-line pt-1 text-center text-ink-500">
              Center Administrator
            </div>
          </div>

          <p className="text-[11px] text-ink-400">
            Generated {formatDate(sheet.data.generatedOn)} · {INSTITUTION.systemName}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
