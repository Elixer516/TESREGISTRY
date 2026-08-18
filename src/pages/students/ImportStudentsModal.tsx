import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/api';
import type { StudentImportRow } from '@/types/views';
import type { CsvRowError } from '@/types';
import { isApiError } from '@/lib/api-error';
import {
  SAMPLE_CSV_TEMPLATE,
  STUDENT_COLUMN_ALIASES,
  mapHeaders,
  parseCsv,
  readCell,
  type HeaderMapping,
} from '@/lib/csv';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  InfoNote,
  Modal,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';

/**
 * CSV import.
 *
 * Parsing happens here in the browser so the reader can see exactly what was
 * understood before anything is sent. The server then re-validates every row
 * and commits all of them or none — a half-imported file is worse than a
 * rejected one.
 */
export function ImportStudentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<HeaderMapping | null>(null);
  const [rows, setRows] = useState<StudentImportRow[]>([]);
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

    const headerMapping = mapHeaders(parsed.headers);
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
        studentNumber: readCell(row, headerMapping, 'studentNumber'),
        firstName: readCell(row, headerMapping, 'firstName'),
        middleName: readCell(row, headerMapping, 'middleName'),
        lastName: readCell(row, headerMapping, 'lastName'),
        email: readCell(row, headerMapping, 'email'),
        contactNumber: readCell(row, headerMapping, 'contactNumber'),
        programCode: readCell(row, headerMapping, 'programCode'),
        yearLevel: Number(readCell(row, headerMapping, 'yearLevel') || '1'),
        sex: readCell(row, headerMapping, 'sex').toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
      })),
    );
  };

  const importRows = useMutation({
    mutationFn: () => studentsApi.import(rows),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        result.imported + ' application(s) imported.',
        'They are pending until each one is approved.',
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
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'registream-student-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import students from CSV"
      description="Every row is checked before anything is written. One bad row stops the whole batch."
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
            disabled={rows.length === 0}
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
          {fileName ? (
            <p className="mt-1.5 text-xs text-ink-500">Reading {fileName}</p>
          ) : null}
        </div>

        {parseError ? (
          <InfoNote tone="danger" title="This file cannot be imported">
            <p>{parseError}</p>
            <p className="mt-2 font-semibold">Accepted column names</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(STUDENT_COLUMN_ALIASES).map(([field, aliases]) => (
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
              <Table className="min-w-[44rem]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Student No.</Th>
                    <Th>Name</Th>
                    <Th>Program</Th>
                    <Th>Year</Th>
                    <Th>Sex</Th>
                    <Th>Email</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <Td className="tabular-nums">{index + 1}</Td>
                      <Td className="tabular-nums">{row.studentNumber}</Td>
                      <Td>
                        {row.lastName}, {row.firstName} {row.middleName}
                      </Td>
                      <Td>{row.programCode}</Td>
                      <Td className="tabular-nums">{row.yearLevel}</Td>
                      <Td>{row.sex}</Td>
                      <Td className="text-xs">{row.email || '—'}</Td>
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
