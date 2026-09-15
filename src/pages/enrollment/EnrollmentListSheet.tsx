import type { EnrollmentView, SemesterView } from '@/types/views';
import { INSTITUTION, SIGNATORIES } from '@/config/institution';
import { formatDate, formatDateTime } from '@/lib/format';
import { Card, InfoNote, Table, TableWrap, Td, Th } from '@/components/ui';
import korphilLogo from '@/assets/korphil-logo.png';

/**
 * The enrolment list for one semester, laid out to be signed and filed.
 *
 * The screen already had this information, but only as a table you could look
 * at — and a registrar's enrolment list is a document, not a view. It gets
 * printed, signed and kept, which is why this carries the seal, the run date,
 * a total at the foot and a signature block: the parts that make a list
 * evidence of something rather than a report of it.
 *
 * Built from the same `listEnrollments` the screen uses, so the paper and the
 * screen cannot disagree. Nothing new is stored.
 */
export function EnrollmentListSheet({
  rows,
  semester,
}: {
  rows: EnrollmentView[];
  semester: SemesterView | null;
}) {
  const active = rows.filter((row) => row.status !== 'DROPPED');
  const dropped = rows.length - active.length;
  const totalUnits = active.reduce((sum, row) => sum + row.totalUnits, 0);

  return (
    <Card className="print-sheet p-5">
      <header className="border-b border-line pb-3 text-center">
        <img src={korphilLogo} alt="" aria-hidden className="mx-auto mb-2 h-16 w-16 object-contain" />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          {INSTITUTION.agency}
        </p>
        <p className="text-sm font-semibold text-ink-900">{INSTITUTION.centre}</p>
        <p className="mt-1 text-xs text-ink-500">{INSTITUTION.address}</p>
        <p className="mt-2 text-sm font-semibold uppercase text-ink-900">Enrollment List</p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <Row label="Diploma" value={semester ? semester.programName : '—'} />
        <Row label="Semester" value={semester ? semester.termLabel : '—'} />
        <Row label="School Year" value={semester?.academicYearLabel ?? '—'} />
        <Row label="Coverage" value={semester ? `${formatDate(semester.startDate)} to ${formatDate(semester.endDate)}` : '—'} />
        <Row label="Trainees listed" value={String(active.length)} />
        <Row label="Generated" value={formatDateTime(new Date().toISOString())} />
      </dl>

      {active.length === 0 ? (
        <div className="mt-4">
          <InfoNote tone="warning">
            Nobody is enrolled in this semester yet, so there is nothing to list.
          </InfoNote>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <TableWrap>
              <Table className="min-w-[40rem]">
                <thead>
                  <tr>
                    <Th className="w-10 text-right">No.</Th>
                    <Th>Student No.</Th>
                    <Th>Name</Th>
                    <Th>Section</Th>
                    <Th className="text-right">Subjects</Th>
                    <Th className="text-right">Units</Th>
                    <Th>Date Enrolled</Th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((row, index) => (
                    <tr key={row.id}>
                      <Td className="text-right tabular-nums text-ink-500">{index + 1}</Td>
                      <Td className="font-mono text-xs">{row.studentNumber}</Td>
                      <Td className="font-medium text-ink-900">{row.studentName}</Td>
                      <Td>{row.sectionCode}</Td>
                      <Td className="text-right tabular-nums">{row.subjectCount}</Td>
                      <Td className="text-right tabular-nums">{row.totalUnits}</Td>
                      <Td className="text-xs text-ink-500">{formatDate(row.enrolledAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-line pt-2 text-xs text-ink-700">
            <span>
              <strong>{active.length}</strong> trainee{active.length === 1 ? '' : 's'} enrolled
              {dropped > 0 ? ` · ${dropped} dropped enrolment${dropped === 1 ? '' : 's'} excluded` : ''}
            </span>
            <span>
              Total units carried: <strong className="tabular-nums">{totalUnits}</strong>
            </span>
          </div>
        </>
      )}

      {/* A list nobody has signed is a printout; signed, it is a record. */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <Signature name={SIGNATORIES.registrarName} title={SIGNATORIES.registrarTitle} caption="Prepared by" />
        <Signature name={SIGNATORIES.centerAdminName} title={SIGNATORIES.centerAdminTitle} caption="Noted by" />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-500">{label}:</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Signature({ name, title, caption }: { name: string; title: string; caption: string }) {
  return (
    <div className="text-xs">
      <p className="text-ink-500">{caption}</p>
      <p className="mt-6 border-t border-ink-900 pt-1 font-semibold uppercase text-ink-900">
        {name}
      </p>
      <p className="text-ink-500">{title}</p>
    </div>
  );
}
