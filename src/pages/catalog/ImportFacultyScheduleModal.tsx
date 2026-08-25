import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesApi } from '@/api';
import type { FacultyScheduleImportRow } from '@/types/views';
import type { CsvRowError } from '@/types';
import { isApiError } from '@/lib/api-error';
import { mapHeaders, parseCsv, readCell, type HeaderMapping } from '@/lib/csv';
import {
  FACULTY_SCHEDULE_COLUMN_ALIASES,
  FACULTY_SCHEDULE_REQUIRED_FIELDS,
  FACULTY_SCHEDULE_SAMPLE_CSV_TEMPLATE,
} from '@/lib/faculty-schedule-csv';
import { useToast } from '@/context/ToastContext';
import { Button, InfoNote, Modal, Table, TableWrap, Td, Th } from '@/components/ui';
import { SchoolYearTermFilter } from '@/components/SchoolYearTermFilter';

/**
 * Faculty & Schedule import.
 *
 * One dataset, not two: each row already carries both a trainor's details
 * and one class's schedule, so importing the file creates/updates the
 * Faculty record AND publishes the class in the same pass — there is no
 * separate "assign a trainor" step afterwards.
 */
export function ImportFacultyScheduleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<HeaderMapping | null>(null);
  const [rows, setRows] = useState<FacultyScheduleImportRow[]>([]);
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<CsvRowError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setMapping(null);
    setRows([]);
    setParseError(null);
    setRowErrors([]);
    setServerError(null);
  }, [open]);

  const readFile = async (file: File) => {
    setParseError(null);
    setRowErrors([]);
    setServerError(null);
    setFileName(file.name);

    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setMapping(null);
      setRows([]);
      setParseError('That file has a header row but no data rows.');
      return;
    }

    const headerMapping = mapHeaders(parsed.headers, FACULTY_SCHEDULE_COLUMN_ALIASES, FACULTY_SCHEDULE_REQUIRED_FIELDS);
    setMapping(headerMapping);

    if (headerMapping.missingRequired.length > 0) {
      setRows([]);
      setParseError(
        'Missing required column(s): ' +
          headerMapping.missingRequired.join(', ') +
          '. Accepted spellings are listed below.',
      );
      return;
    }

    setRows(
      parsed.rows.map((row) => ({
        employeeId: readCell(row, headerMapping, 'employeeId'),
        firstName: readCell(row, headerMapping, 'firstName'),
        lastName: readCell(row, headerMapping, 'lastName'),
        department: readCell(row, headerMapping, 'department'),
        position: readCell(row, headerMapping, 'position'),
        email: readCell(row, headerMapping, 'email'),
        contactNumber: readCell(row, headerMapping, 'contactNumber'),
        subjectCode: readCell(row, headerMapping, 'subjectCode'),
        sectionCode: readCell(row, headerMapping, 'sectionCode'),
        days: readCell(row, headerMapping, 'days'),
        startTime: readCell(row, headerMapping, 'startTime'),
        endTime: readCell(row, headerMapping, 'endTime'),
        room: readCell(row, headerMapping, 'room'),
      })),
    );
  };

  const importRows = useMutation({
    mutationFn: () => schedulesApi.importFacultyAndSchedules(rows, semesterId ?? ''),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        `${result.schedulesPublished} class(es) published.`,
        `${result.facultyCreated} new trainor(s), ${result.facultyUpdated} updated.`,
      );
      onClose();
    },
    onError: (caught) => {
      if (isApiError(caught)) {
        setRowErrors(caught.rowErrors ?? []);
        setServerError(caught.message);
      } else {
        setServerError('The import failed.');
      }
    },
  });

  const downloadTemplate = () => {
    const blob = new Blob([FACULTY_SCHEDULE_SAMPLE_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'registream-faculty-schedule-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const ready = rows.length > 0 && Boolean(semesterId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import faculty & schedules"
      description="Each row is one class a trainor teaches. Published immediately — no separate publish step."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={downloadTemplate}>
            Download template
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ready}
            loading={importRows.isPending}
            onClick={() => {
              setRowErrors([]);
              setServerError(null);
              importRows.mutate();
            }}
          >
            Import {rows.length > 0 ? rows.length + ' row(s)' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-700 file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          {fileName ? <p className="mt-1.5 text-xs text-ink-500">Reading {fileName}</p> : null}
        </div>

        <SchoolYearTermFilter semesterId={semesterId} onChange={setSemesterId} label="Term these classes belong to" />

        {parseError ? (
          <InfoNote tone="danger" title="This file cannot be imported">
            <p>{parseError}</p>
            <p className="mt-2 font-semibold">Accepted column names</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(FACULTY_SCHEDULE_COLUMN_ALIASES).map(([field, aliases]) => (
                <li key={field}>
                  <span className="font-mono text-[11px]">{field}</span>: {aliases.join(', ')}
                </li>
              ))}
            </ul>
          </InfoNote>
        ) : null}

        {mapping && mapping.unmatchedHeaders.length > 0 ? (
          <InfoNote tone="warning" title="Columns that will be ignored">
            {mapping.unmatchedHeaders.join(', ')}
          </InfoNote>
        ) : null}

        {serverError ? (
          <InfoNote tone="danger" title="Nothing was imported">
            {serverError}
          </InfoNote>
        ) : null}

        {rowErrors.length > 0 ? (
          <TableWrap className="rounded-lg border border-danger/40">
            <Table className="min-w-[30rem]">
              <thead>
                <tr>
                  <Th className="bg-danger-soft text-danger-ink">Row</Th>
                  <Th className="bg-danger-soft text-danger-ink">Column</Th>
                  <Th className="bg-danger-soft text-danger-ink">Problem</Th>
                </tr>
              </thead>
              <tbody>
                {rowErrors.map((rowError, index) => (
                  <tr key={index}>
                    <Td className="tabular-nums">{rowError.row}</Td>
                    <Td className="font-mono text-xs">{rowError.field}</Td>
                    <Td>{rowError.message}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : null}

        {rows.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Preview — {rows.length} row(s) understood
            </p>
            <TableWrap className="max-h-72 overflow-y-auto rounded-lg border border-line">
              <Table className="min-w-[48rem]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Employee ID</Th>
                    <Th>Trainor</Th>
                    <Th>Subject</Th>
                    <Th>Section</Th>
                    <Th>Days</Th>
                    <Th>Time</Th>
                    <Th>Room</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <Td className="tabular-nums">{index + 1}</Td>
                      <Td className="tabular-nums">{row.employeeId}</Td>
                      <Td>{row.lastName}, {row.firstName}</Td>
                      <Td>{row.subjectCode}</Td>
                      <Td>{row.sectionCode}</Td>
                      <Td className="text-xs">{row.days}</Td>
                      <Td className="text-xs">{row.startTime}–{row.endTime}</Td>
                      <Td className="text-xs">{row.room || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
