import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayCode, ScheduleConflictDetail, Subject } from '@/types';
import { ALL_DAYS, DAY_LABELS } from '@/types';
import { catalogApi, schedulesApi, usersApi } from '@/api';
import type { ClassScheduleView, FacultyView, SectionView } from '@/types/views';
import { errorMessage, isApiError } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, TextInput } from '@/components/ui';
import { PickerButton } from '@/components/RecordPicker';
import { FacultyPicker, SectionPicker, SubjectPicker } from '@/components/pickers';
import { ScheduleConflictModal } from '@/components/ScheduleConflictModal';

/**
 * Create or edit a schedule.
 *
 * A conflict is not a warning here — the save is refused and the modal names
 * the clashing class and the rule it broke.
 */
export function ScheduleFormModal({
  open,
  schedule,
  semesterId,
  onClose,
}: {
  open: boolean;
  schedule: ClassScheduleView | null;
  semesterId: string | null;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [section, setSection] = useState<SectionView | null>(null);
  const [faculty, setFaculty] = useState<FacultyView | null>(null);
  const [days, setDays] = useState<DayCode[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [room, setRoom] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflictDetail[]>([]);
  const [conflictMessage, setConflictMessage] = useState('');

  const [subjectPicker, setSubjectPicker] = useState(false);
  const [sectionPicker, setSectionPicker] = useState(false);
  const [facultyPicker, setFacultyPicker] = useState(false);

  const queryClient = useQueryClient();
  const toast = useToast();

  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => catalogApi.listSemesters(),
    enabled: open,
  });
  const subjects = useQuery({
    queryKey: ['subjects'],
    queryFn: () => catalogApi.listSubjects(),
    enabled: open,
  });
  const sections = useQuery({
    queryKey: ['sections', 'all'],
    queryFn: () => catalogApi.listSections(),
    enabled: open,
  });
  const facultyList = useQuery({
    queryKey: ['faculty', 'picker'],
    queryFn: () => usersApi.listFaculty(''),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConflicts([]);
    if (schedule) {
      setSubject(subjects.data?.find((s) => s.id === schedule.subjectId) ?? null);
      setSection(sections.data?.find((s) => s.id === schedule.sectionId) ?? null);
      setFaculty(facultyList.data?.find((f) => f.id === schedule.facultyId) ?? null);
      setDays([...schedule.days]);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setRoom(schedule.room);
      setTerm(schedule.semesterId);
    } else {
      setSubject(null);
      setSection(null);
      setFaculty(null);
      setDays([]);
      setStartTime('08:00');
      setEndTime('09:00');
      setRoom('');
      setTerm(semesterId ?? '');
    }
  }, [open, schedule, semesterId, subjects.data, sections.data, facultyList.data]);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        semesterId: term,
        subjectId: subject?.id ?? '',
        sectionId: section?.id ?? '',
        facultyId: faculty?.id ?? null,
        days,
        startTime,
        endTime,
        room,
      };
      return schedule ? schedulesApi.update(schedule.id, input) : schedulesApi.create(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(
        schedule ? 'Schedule updated.' : 'Schedule created as a draft.',
        saved.subjectCode + ' · ' + saved.sectionCode + ' · ' + saved.dayPattern + ' ' + saved.timeRange,
      );
      onClose();
    },
    onError: (caught) => {
      if (isApiError(caught) && caught.code === 'SCHEDULE_CONFLICT') {
        setConflicts(caught.conflicts ?? []);
        setConflictMessage(caught.message);
        return;
      }
      setError(errorMessage(caught));
    },
  });

  const toggleDay = (day: DayCode) =>
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  const ready = Boolean(subject && section && term && days.length > 0);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={schedule ? 'Edit schedule' : 'New schedule'}
        description="New schedules start as drafts. Publishing is a separate, deliberate step."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!ready}
              loading={save.isPending}
              onClick={() => {
                setError(null);
                setConflicts([]);
                save.mutate();
              }}
            >
              {schedule ? 'Save changes' : 'Create draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PickerButton
              label="Subject"
              value={subject ? subject.code + ' — ' + subject.title : null}
              placeholder="Choose a subject…"
              onClick={() => setSubjectPicker(true)}
              onClear={() => setSubject(null)}
            />
            <PickerButton
              label="Section"
              value={section ? section.code : null}
              placeholder="Choose a section…"
              onClick={() => setSectionPicker(true)}
              onClear={() => setSection(null)}
            />
            <PickerButton
              label="Trainer"
              value={faculty ? faculty.fullName + ' · ' + faculty.employeeId : null}
              placeholder="Choose a trainer…"
              onClick={() => setFacultyPicker(true)}
              onClear={() => setFaculty(null)}
            />
            <Field label="Term" htmlFor="sf-term" required>
              <Select id="sf-term" value={term} onChange={(event) => setTerm(event.target.value)}>
                <option value="">Select a term…</option>
                {(semesters.data ?? []).map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.label}
                    {semester.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-ink-700">
              Days <span className="text-danger">*</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const selected = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(day)}
                    className={
                      'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ' +
                      (selected
                        ? 'border-transparent bg-brand text-white'
                        : 'border-line bg-surface text-ink-700 hover:bg-surface-2')
                    }
                  >
                    {DAY_LABELS[day].slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">
              Stored as canonical codes, so TTh always means Tuesday and Thursday.
            </p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start time" htmlFor="sf-start" required hint="Normalised to HH:MM on save.">
              <TextInput
                id="sf-start"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                placeholder="09:00 or 9:00 AM"
              />
            </Field>
            <Field label="End time" htmlFor="sf-end" required>
              <TextInput
                id="sf-end"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                placeholder="11:00"
              />
            </Field>
            <Field
              label="Room"
              htmlFor="sf-room"
              hint="TBA, TBD or blank is not treated as a real room, so it never conflicts."
            >
              <TextInput
                id="sf-room"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                placeholder="Computer Lab 1"
              />
            </Field>
          </div>

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      </Modal>

      <SubjectPicker
        open={subjectPicker}
        onClose={() => setSubjectPicker(false)}
        onSelect={setSubject}
        selectedId={subject?.id ?? null}
      />
      <SectionPicker
        open={sectionPicker}
        onClose={() => setSectionPicker(false)}
        onSelect={setSection}
        selectedId={section?.id ?? null}
      />
      <FacultyPicker
        open={facultyPicker}
        onClose={() => setFacultyPicker(false)}
        onSelect={setFaculty}
        selectedId={faculty?.id ?? null}
      />

      <ScheduleConflictModal
        open={conflicts.length > 0}
        conflicts={conflicts}
        message={conflictMessage}
        onClose={() => setConflicts([])}
      />
    </>
  );
}
