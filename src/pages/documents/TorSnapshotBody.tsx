import type { DocumentSnapshot } from '@/types';
import { INSTITUTION, SIGNATORIES } from '@/config/institution';
import { formatDate } from '@/lib/format';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import korphilLogo from '@/assets/korphil-logo.png';

/** Static grading-system legend, as printed on the institution's real TOR. */
const GRADING_LEGEND_A: Array<[string, string, string]> = [
  ['1.00', '99-100%', 'Excellent'],
  ['1.25', '96-98%', 'Very Good'],
  ['1.50', '93-95%', 'Very Good'],
  ['1.75', '90-92%', 'Good'],
  ['2.00', '87-89%', 'Good'],
  ['2.25', '84-86%', 'Satisfactory'],
];
const GRADING_LEGEND_B: Array<[string, string, string]> = [
  ['2.50', '81-83%', 'Satisfactory'],
  ['2.75', '78-80%', 'Pass'],
  ['3.00', '75-77%', 'Pass'],
  ['4.00', '74% and below', 'Conditional'],
  ['5.00', 'below 60%', 'Failed'],
];
const GRADING_LEGEND_C: Array<[string, string]> = [
  ['INC', 'Incomplete'],
  ['DRP', 'Dropped'],
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-500">{label}:</dt>
      <dd className="font-medium text-ink-900">{value || '—'}</dd>
    </div>
  );
}

/**
 * The rich TOR layout, matching the institution's real Transcript of Records
 * format — richer than the shared template every other document type uses.
 */
export function TorSnapshotBody({
  snapshot,
  serialNumber,
}: {
  snapshot: DocumentSnapshot;
  serialNumber: string;
}) {
  return (
    <div className="print-sheet space-y-4 text-sm">
      <header className="border-b border-line pb-3 text-center">
        <img src={korphilLogo} alt="" aria-hidden className="mx-auto mb-2 h-16 w-16 object-contain" />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          Republic of the Philippines
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          {INSTITUTION.agency}
        </p>
        <p className="text-sm font-semibold text-ink-900">{INSTITUTION.centre}</p>
        <p className="mt-1 text-xs text-ink-500">{INSTITUTION.address}</p>
        <p className="mt-2 text-sm font-semibold uppercase text-ink-900">
          Official Transcript of Records
        </p>
      </header>

      <p>
        <span className="text-ink-500">Name:</span>{' '}
        <span className="font-semibold text-ink-900">{snapshot.studentName}</span>
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-b border-line pb-3">
        <Row label="TOR No." value={serialNumber} />
        <Row label="Learner's ID" value={snapshot.learnerId} />
        <Row label="Home Address" value={snapshot.address} />
        <Row label="NSTP Serial No." value={snapshot.nstpSerialNo} />
        <Row label="Birth Date" value={snapshot.birthDate} />
        <Row label="Birth Place" value={snapshot.birthPlace} />
        <Row label="Secondary School" value={snapshot.secondarySchool} />
        <Row label="Last Attended" value={snapshot.secondarySchoolYearAttended} />
        <Row label="Basis of Admission" value={snapshot.basisOfAdmission} />
        <Row label="Date Admitted" value={snapshot.dateAdmitted} />
        <Row label="Course" value={snapshot.programName} />
        <Row label="Date Graduated" value={snapshot.graduatedOn ?? 'N/A'} />
      </dl>

      {snapshot.groups.length === 0 ? (
        <p className="text-ink-500">This student has no subjects on record yet.</p>
      ) : (
        snapshot.groups.map((group, index) => (
          <div key={group.academicYearLabel + '-' + group.periodLabel + '-' + index}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700">
              {group.academicYearLabel}
              {group.rows[0]?.source === 'PREVIOUS_SCHOOL'
                ? ' — credited from previous school'
                : ' · ' + group.periodLabel}
            </p>
            <TableWrap>
              <Table className="min-w-[38rem]">
                <thead>
                  <tr>
                    <Th>Course code</Th>
                    <Th>Course title</Th>
                    <Th className="text-right">Final</Th>
                    <Th className="text-right">Completion</Th>
                    <Th className="text-right">Units</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, rowIndex) => (
                    <tr key={row.courseCode + '-' + rowIndex}>
                      <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                      <Td>{row.courseTitle}</Td>
                      <Td className="text-right tabular-nums">{row.grade}</Td>
                      <Td className="text-right tabular-nums">{row.completionGrade}</Td>
                      <Td className="text-right tabular-nums">{row.units}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <Td className="font-semibold text-ink-900">Term total</Td>
                    <Td> </Td>
                    <Td className="text-right font-semibold tabular-nums text-ink-900">
                      {group.termGwa}
                    </Td>
                    <Td> </Td>
                    <Td className="text-right font-semibold tabular-nums text-ink-900">
                      {group.termUnits}
                    </Td>
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          </div>
        ))
      )}

      <p className="text-center text-xs font-semibold tracking-wide text-ink-700">
        ------------------------------ TRANSCRIPT CLOSED ------------------------------
      </p>

      {snapshot.graduatedOn ? (
        <div className="space-y-1 border-t border-line pt-3">
          <p>
            <span className="font-semibold text-ink-900">GRADUATED:</span> FROM THE{' '}
            {snapshot.programName.toUpperCase()} AS OF {snapshot.graduatedOn.toUpperCase()}.
          </p>
          {snapshot.specialOrderNo ? (
            <p className="text-xs text-ink-500">Special Order No.: {snapshot.specialOrderNo}</p>
          ) : null}
        </div>
      ) : null}

      {snapshot.notes.length > 0 ? (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-500">
          {snapshot.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="page-break border-t border-line pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700">
          Grading system
        </p>
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left text-ink-500">
                <th className="py-0.5 font-medium">Rating</th>
                <th className="py-0.5 font-medium">Equivalent</th>
                <th className="py-0.5 font-medium">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {GRADING_LEGEND_A.map(([rating, equiv, descriptor]) => (
                <tr key={rating}>
                  <td className="py-0.5 tabular-nums">{rating}</td>
                  <td className="py-0.5">{equiv}</td>
                  <td className="py-0.5">{descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left text-ink-500">
                <th className="py-0.5 font-medium">Rating</th>
                <th className="py-0.5 font-medium">Equivalent</th>
                <th className="py-0.5 font-medium">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {GRADING_LEGEND_B.map(([rating, equiv, descriptor]) => (
                <tr key={rating}>
                  <td className="py-0.5 tabular-nums">{rating}</td>
                  <td className="py-0.5">{equiv}</td>
                  <td className="py-0.5">{descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left text-ink-500">
                <th className="py-0.5 font-medium">Rating</th>
                <th className="py-0.5 font-medium">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {GRADING_LEGEND_C.map(([rating, descriptor]) => (
                <tr key={rating}>
                  <td className="py-0.5 tabular-nums">{rating}</td>
                  <td className="py-0.5">{descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-10 text-xs">
        <div className="border-t border-line pt-1 text-center">
          <p className="font-semibold text-ink-900">{SIGNATORIES.registrarName}</p>
          <p className="text-ink-500">{SIGNATORIES.registrarTitle}</p>
        </div>
        <div className="border-t border-line pt-1 text-center">
          <p className="font-semibold text-ink-900">{SIGNATORIES.centerAdminName}</p>
          <p className="text-ink-500">{SIGNATORIES.centerAdminTitle}</p>
        </div>
      </div>

      <p className="text-center text-[11px] font-semibold text-ink-700">
        NOT VALID WITHOUT THE CENTER SEAL
      </p>

      <p className="text-[11px] text-ink-400">
        {serialNumber} · generated {formatDate(snapshot.generatedOn)} · {INSTITUTION.systemName}.
      </p>
    </div>
  );
}
