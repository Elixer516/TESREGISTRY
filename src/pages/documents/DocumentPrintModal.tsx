import type { GeneratedDocument } from '@/types';
import { DOCUMENT_TYPE_LABELS } from '@/types';
import { INSTITUTION } from '@/config/institution';
import { formatDate } from '@/lib/format';
import { Button, InfoNote, Modal, Table, TableWrap, Td, Th } from '@/components/ui';
import korphilLogo from '@/assets/korphil-logo.png';
import { TorSnapshotBody } from './TorSnapshotBody';

/**
 * Printable output, styled for Long Bond (8.5in × 13in).
 *
 * Everything rendered here comes from the stored snapshot rather than a fresh
 * query, so an issued document keeps saying what it said when it was issued.
 */
export function DocumentPrintModal({
  document: generated,
  onClose,
}: {
  document: GeneratedDocument | null;
  onClose: () => void;
}) {
  const snapshot = generated?.snapshot;

  return (
    <Modal
      open={generated !== null}
      onClose={onClose}
      title={generated ? DOCUMENT_TYPE_LABELS[generated.documentType] : 'Document'}
      description={generated ? 'Serial ' + generated.serialNumber : undefined}
      size="xl"
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
      {snapshot && generated && generated.documentType === 'TOR' ? (
        <TorSnapshotBody snapshot={snapshot} serialNumber={generated.serialNumber} />
      ) : snapshot && generated ? (
        <div className="print-sheet space-y-4">
          <header className="border-b border-line pb-3 text-center">
            <img src={korphilLogo} alt="" aria-hidden className="mx-auto mb-2 h-16 w-16 object-contain" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
              {INSTITUTION.agency}
            </p>
            <p className="text-sm font-semibold text-ink-900">{INSTITUTION.centre}</p>
            <p className="mt-1 text-xs text-ink-500">{INSTITUTION.address}</p>
            <p className="mt-2 text-sm font-semibold uppercase text-ink-900">
              {DOCUMENT_TYPE_LABELS[generated.documentType]}
            </p>
          </header>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <Row label="Name" value={snapshot.studentName} />
            <Row label="Student No." value={snapshot.studentNumber} />
            <Row label="Program" value={snapshot.programCode + ' — ' + snapshot.programName} />
            <Row label="Curriculum" value={snapshot.curriculumName} />
            <Row label="Sex" value={snapshot.sex} />
            <Row label="Date of birth" value={snapshot.birthDate} />
            <Row label="Address" value={snapshot.address} />
            <Row label="Standing" value={snapshot.status} />
          </dl>

          {snapshot.groups.length === 0 ? (
            <InfoNote tone="info">
              This document type carries no subject listing.
            </InfoNote>
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
                      {group.rows.map((row, rowIndex) => (
                        <tr key={row.courseCode + '-' + rowIndex}>
                          <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                          <Td>{row.courseTitle}</Td>
                          <Td className="text-right tabular-nums">{row.units}</Td>
                          <Td className="text-right tabular-nums">{row.grade}</Td>
                          <Td className="text-xs">{row.remarks}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <Td className="font-semibold text-ink-900">Term total</Td>
                        <Td> </Td>
                        <Td className="text-right font-semibold tabular-nums text-ink-900">
                          {group.termUnits}
                        </Td>
                        <Td className="text-right font-semibold tabular-nums text-ink-900">
                          {group.termGwa}
                        </Td>
                        <Td> </Td>
                      </tr>
                    </tfoot>
                  </Table>
                </TableWrap>
              </div>
            ))
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line pt-3 text-sm">
            <Row label="Total units" value={String(snapshot.totalUnits)} />
            <Row label="General average" value={snapshot.overallGwa} />
          </dl>

          {snapshot.notes.length > 0 ? (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-500">
              {snapshot.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid grid-cols-2 gap-8 pt-10 text-xs">
            <div className="border-t border-line pt-1 text-center text-ink-500">Registrar</div>
            <div className="border-t border-line pt-1 text-center text-ink-500">
              Center Administrator
            </div>
          </div>

          <p className="text-[11px] text-ink-400">
            {generated.serialNumber} · generated {formatDate(snapshot.generatedOn)} ·{' '}
            {INSTITUTION.systemName}. Not valid without the dry seal of the centre.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-500">{label}:</dt>
      <dd className="font-medium text-ink-900">{value || '—'}</dd>
    </div>
  );
}
