import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SemesterPeriod, Subject } from '@/types';
import { ALL_SEMESTER_PERIODS, SEMESTER_PERIOD_LABELS, semesterPeriodLabel } from '@/types';
import { catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Modal,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { SubjectPicker } from '@/components/pickers';
import { ImportCurriculumModal } from './ImportCurriculumModal';

/**
 * Curricula and the curriculum-to-subject mapping.
 *
 * A diploma may hold several curricula at once, and usually does: an edition
 * is never retired while trainees are still finishing under it. DIT carries
 * its 2022 edition alongside the 2024 revision for exactly that reason. So
 * "New curriculum" is how a fresh edition is started, and marking the old one
 * inactive closes it to new intake **without** disturbing anybody already on
 * it — inactive here means "not offered to newcomers", never "unusable".
 */
export function CurriculaPanel({ canWrite }: { canWrite: boolean }) {
  const [curriculumId, setCurriculumId] = useState('');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ programId: '', code: '', name: '', effectiveYear: '' });
  const [yearLevel, setYearLevel] = useState(1);
  const [semesterPeriod, setSemesterPeriod] = useState<SemesterPeriod>('FIRST');
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const curricula = useQuery({
    queryKey: ['curricula', 'all'],
    queryFn: () => catalogApi.listCurricula(),
  });

  useEffect(() => {
    if (!curriculumId && curricula.data?.[0]) setCurriculumId(curricula.data[0].id);
  }, [curricula.data, curriculumId]);

  const mappings = useQuery({
    queryKey: ['curriculum-subjects', curriculumId],
    queryFn: () => catalogApi.listCurriculumSubjects(curriculumId),
    enabled: Boolean(curriculumId),
  });

  const map = useMutation({
    mutationFn: () =>
      catalogApi.mapSubject({
        curriculumId,
        subjectId: subject?.id ?? '',
        yearLevel,
        semesterPeriod,
        isRequired: true,
      }),
    onSuccess: (rows) => {
      queryClient.setQueryData(['curriculum-subjects', curriculumId], rows);
      queryClient.invalidateQueries({ queryKey: ['curricula'] });
      toast.success('Subject mapped into the curriculum.');
      setSubject(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const unmap = useMutation({
    mutationFn: (id: string) => catalogApi.unmapSubject(id),
    onSuccess: (rows) => {
      queryClient.setQueryData(['curriculum-subjects', curriculumId], rows);
      queryClient.invalidateQueries({ queryKey: ['curricula'] });
      toast.success('Subject removed from the curriculum.', 'The subject record itself is untouched.');
    },
    onError: (caught) => toast.error('Could not remove that mapping.', errorMessage(caught)),
  });

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const createCurriculum = useMutation({
    mutationFn: () => catalogApi.createCurriculum(draft),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['curricula'] });
      toast.success(
        `${created.code} created.`,
        'Map its subjects in, then close the previous edition to new intake when you are ready.',
      );
      setCurriculumId(created.id);
      setNewOpen(false);
      setDraft({ programId: '', code: '', name: '', effectiveYear: '' });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const selected = (curricula.data ?? []).find((row) => row.id === curriculumId);
  const rows = mappings.data ?? [];

  return (
    <>
      {canWrite ? (
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Import curriculum
          </Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            New curriculum
          </Button>
        </div>
      ) : null}

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New curriculum"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createCurriculum.isPending}
              disabled={!draft.programId || !draft.code.trim() || !draft.name.trim()}
              onClick={() => createCurriculum.mutate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <InfoNote tone="info" title="Adding an edition, not replacing one">
            A new curriculum sits alongside the diploma's existing ones. Trainees
            already enrolled keep the edition they started under — nothing moves
            them. Close the previous edition to new intake separately, once this
            one is ready to receive applicants.
          </InfoNote>

          <Field label="Diploma" htmlFor="new-cur-program">
            <Select
              id="new-cur-program"
              value={draft.programId}
              onChange={(event) =>
                setDraft((d) => ({ ...d, programId: event.target.value }))
              }
            >
              <option value="">Choose a diploma…</option>
              {(programs.data ?? []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} — {program.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Curriculum code"
            htmlFor="new-cur-code"
            hint="Unique across the centre. An edition is usually the diploma code plus its year, e.g. DIT-2022."
          >
            <TextInput
              id="new-cur-code"
              value={draft.code}
              onChange={(event) => setDraft((d) => ({ ...d, code: event.target.value }))}
              placeholder="DIT-2022"
            />
          </Field>

          <Field label="Name" htmlFor="new-cur-name">
            <TextInput
              id="new-cur-name"
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              placeholder="Diploma in Information Technology (2022 edition)"
            />
          </Field>

          <Field
            label="Effective year"
            htmlFor="new-cur-year"
            hint="The intake this edition was written for. It is what tells two trainees on different editions apart."
          >
            <TextInput
              id="new-cur-year"
              value={draft.effectiveYear}
              onChange={(event) =>
                setDraft((d) => ({ ...d, effectiveYear: event.target.value }))
              }
              placeholder="2022-2025"
            />
          </Field>
        </div>
      </Modal>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Curriculum" htmlFor="cur-select">
            <Select
              id="cur-select"
              value={curriculumId}
              onChange={(event) => setCurriculumId(event.target.value)}
            >
              {(curricula.data ?? []).map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>
                  {curriculum.programCode} · {curriculum.code} — {curriculum.name}
                </option>
              ))}
            </Select>
          </Field>
          {selected ? (
            <div className="flex items-end gap-2">
              <Badge tone="brand">{selected.subjectCount} subjects</Badge>
              <Badge tone="neutral">{selected.totalUnits} units</Badge>
              <Badge tone={selected.isActive ? 'success' : 'neutral'}>
                {selected.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ) : null}
        </div>
      </Card>

      {canWrite ? (
        <Card className="mb-4">
          <CardHeader
            title="Map a subject into this curriculum"
            description="Pick an existing subject rather than creating a second copy of one."
          />
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <PickerButton
                label="Subject"
                value={subject ? subject.code + ' — ' + subject.title : null}
                placeholder="Choose a subject…"
                onClick={() => setPickerOpen(true)}
                onClear={() => setSubject(null)}
              />
            </div>
            <Field label="Year level" htmlFor="map-year">
              <TextInput
                id="map-year"
                type="number"
                min={1}
                max={6}
                value={yearLevel}
                onChange={(event) => setYearLevel(Number(event.target.value))}
              />
            </Field>
            <Field label="Semester" htmlFor="map-semester">
              <Select
                id="map-semester"
                value={semesterPeriod}
                onChange={(event) => setSemesterPeriod(event.target.value as SemesterPeriod)}
              >
                {ALL_SEMESTER_PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {SEMESTER_PERIOD_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-4">
              <Button
                variant="primary"
                disabled={!subject || !curriculumId}
                loading={map.isPending}
                onClick={() => {
                  setError(null);
                  map.mutate();
                }}
              >
                Add to curriculum
              </Button>
            </div>
            {error ? (
              <div className="sm:col-span-4">
                <InfoNote tone="danger">{error}</InfoNote>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Curriculum contents" description="Grouped by year level and semester." />
        {mappings.isLoading ? (
          <div className="p-4">
            <LoadingState label="Loading curriculum…" rows={3} />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-ink-500">
            No subjects are mapped yet. A student on this curriculum would have nothing to enroll in.
          </p>
        ) : (
          <TableWrap>
            <Table className="min-w-[44rem]">
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th>Semester</Th>
                  <Th>Subject</Th>
                  <Th className="text-right">Units</Th>
                  {canWrite ? <Th className="text-right">Action</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.programSubjectId}>
                    <Td className="tabular-nums">{row.yearLevel}</Td>
                    <Td>{semesterPeriodLabel(row.yearLevel, row.semesterPeriod)}</Td>
                    <Td>
                      <span className="block font-medium text-ink-900">{row.subject.code}</span>
                      <span className="block text-xs text-ink-500">{row.subject.title}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{row.subject.units}</Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unmap.mutate(row.programSubjectId)}
                        >
                          Remove
                        </Button>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <SubjectPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setSubject}
        selectedId={subject?.id ?? null}
      />
      <ImportCurriculumModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
