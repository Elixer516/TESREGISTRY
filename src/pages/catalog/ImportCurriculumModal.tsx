import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import type { CurriculumImportRow } from '@/types/views';
import type { CsvRowError } from '@/types';
import { isApiError } from '@/lib/api-error';
import { mapHeaders, parseCsv, readCell, type HeaderMapping } from '@/lib/csv';
import {
  CURRICULUM_COLUMN_ALIASES,
  CURRICULUM_REQUIRED_FIELDS,
  CURRICULUM_SAMPLE_CSV_TEMPLATE,
  parseSemesterPeriod,
  parseTerm,
} from '@/lib/curriculum-csv';
import { useToast } from '@/context/ToastContext';
import { Button, InfoNote, Modal, Table, TableWrap, Td, Th } from '@/components/ui';

/**
 * Curriculum import.
 *
 * One row is one subject a curriculum requires. Re-uploading a revised sheet
 * updates the curriculum (matched by code) and adds whatever rows aren't
 * already mapped — it never removes an existing mapping, since a subject a
 * student is already using should never silently disappear from the plan.
 */
export function ImportCurriculumModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<HeaderMapping | null>(null);
  const [rows, setRows] = useState<CurriculumImportRow[]>([]);
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

    const headerMapping = mapHeaders(parsed.headers, CURRICULUM_COLUMN_ALIASES, CURRICULUM_REQUIRED_FIELDS);
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
        curriculumCode: readCell(row, headerMapping, 'curriculumCode'),
        curriculumName: readCell(row, headerMapping, 'curriculumName'),
        programCode: readCell(row, headerMapping, 'programCode'),
        effectiveYear: readCell(row, headerMapping, 'effectiveYear'),
        subjectCode: readCell(row, headerMapping, 'subjectCode'),
        yearLevel: Number(readCell(row, headerMapping, 'yearLevel') || '1'),
        semesterPeriod: parseSemesterPeriod(readCell(row, headerMapping, 'semesterPeriod')),
        term: parseTerm(readCell(row, headerMapping, 'term')),
      })),
    );
  };

  const importRows = useMutation({
    mutationFn: () => catalogApi.importCurriculum(rows),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['curricula'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-subjects'] });
      toast.success(
        `${result.curriculaCreated} curricula created, ${result.curriculaUpdated} updated.`,
        `${result.subjectsMapped} subject(s) mapped.`,
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
    const blob = new Blob([CURRICULUM_SAMPLE_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'registream-curriculum-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import curriculum"
      description="One row per subject the curriculum requires. Existing mappings are never removed."
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
          {fileName ? <p className="mt-1.5 text-xs text-ink-500">Reading {fileName}</p> : null}
        </div>

        {parseError ? (
          <InfoNote tone="danger" title="This file cannot be imported">
            <p>{parseError}</p>
            <p className="mt-2 font-semibold">Accepted column names</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(CURRICULUM_COLUMN_ALIASES).map(([field, aliases]) => (
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
              <Table className="min-w-[42rem]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Curriculum</Th>
                    <Th>Program</Th>
                    <Th>Subject</Th>
                    <Th>Year</Th>
                    <Th>Semester</Th>
                    <Th>Term</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <Td className="tabular-nums">{index + 1}</Td>
                      <Td>{row.curriculumCode}</Td>
                      <Td>{row.programCode}</Td>
                      <Td>{row.subjectCode}</Td>
                      <Td className="tabular-nums">{row.yearLevel}</Td>
                      <Td className="text-xs">{row.semesterPeriod}</Td>
                      <Td className="text-xs">{row.term}</Td>
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
