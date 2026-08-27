/**
 * Concrete record pickers.
 *
 * Each one is a thin binding of RecordPicker to a query, so every selector in
 * the app searches, highlights and keyboard-navigates the same way.
 */

import { useQuery } from '@tanstack/react-query';
import { auditApi, catalogApi, studentsApi } from '@/api';
import type { StudentStatus, Subject } from '@/types';
import type {
  FacultyView,
  SectionView,
  StudentView,
} from '@/types/views';
import { RecordPicker } from './RecordPicker';

function studentSearchText(student: StudentView): string {
  return [
    student.fullName,
    student.lastFirstName,
    student.studentNumber,
    student.programCode,
  ].join(' ');
}

export function StudentPicker({
  open,
  onClose,
  onSelect,
  selectedId,
  statuses,
  title = 'Find a student',
  description = 'Search by name or student number.',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (student: StudentView) => void;
  selectedId?: string | null;
  statuses?: StudentStatus[];
  title?: string;
  description?: string;
}) {
  const query = useQuery({
    queryKey: ['students', 'picker', statuses ?? 'all'],
    queryFn: () => studentsApi.list(statuses ? { statuses } : {}),
    enabled: open,
  });

  return (
    <RecordPicker<StudentView>
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      items={query.data ?? []}
      isLoading={query.isLoading}
      error={query.error}
      selectedId={selectedId}
      getId={(student) => student.id}
      getPrimary={(student) => student.lastFirstName}
      getSecondary={(student) =>
        student.studentNumber + ' · ' + student.programCode + ' · Year ' + student.yearLevel
      }
      getTrailing={(student) => student.status}
      getSearchText={studentSearchText}
      onSelect={onSelect}
      searchPlaceholder="Search name or student number…"
    />
  );
}

/** Students who may be issued a document — anyone with standing at the centre. */
export function DocumentStudentPicker({
  open,
  onClose,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (student: StudentView) => void;
  selectedId?: string | null;
}) {
  const query = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.list({}),
    enabled: open,
  });

  return (
    <RecordPicker<StudentView>
      open={open}
      onClose={onClose}
      title="Find a student"
      description="Only students with standing at the centre appear here — a pending or rejected applicant cannot be issued a document."
      items={query.data ?? []}
      isLoading={query.isLoading}
      error={query.error}
      selectedId={selectedId}
      getId={(student) => student.id}
      getPrimary={(student) => student.lastFirstName}
      getSecondary={(student) => student.studentNumber + ' · ' + student.programCode}
      getTrailing={(student) => student.status}
      getSearchText={studentSearchText}
      onSelect={onSelect}
      searchPlaceholder="Search name or student number…"
    />
  );
}

export function FacultyPicker({
  open,
  onClose,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (faculty: FacultyView) => void;
  selectedId?: string | null;
}) {
  const query = useQuery({
    queryKey: ['faculty', 'picker'],
    queryFn: () => auditApi.listFaculty(''),
    enabled: open,
  });

  return (
    <RecordPicker<FacultyView>
      open={open}
      onClose={onClose}
      title="Find a faculty record"
      description="Search by name, employee ID or diploma."
      items={query.data ?? []}
      isLoading={query.isLoading}
      error={query.error}
      selectedId={selectedId}
      getId={(faculty) => faculty.id}
      getPrimary={(faculty) => faculty.fullName}
      getSecondary={(faculty) =>
        [faculty.employeeId, faculty.diploma, faculty.position].join(' · ')
      }
      getSearchText={(faculty) =>
        [faculty.fullName, faculty.employeeId, faculty.diploma, faculty.position].join(' ')
      }
      onSelect={onSelect}
      searchPlaceholder="Search name, employee ID or diploma…"
    />
  );
}

export function SubjectPicker({
  open,
  onClose,
  onSelect,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (subject: Subject) => void;
  selectedId?: string | null;
}) {
  const query = useQuery({
    queryKey: ['subjects'],
    queryFn: () => catalogApi.listSubjects(),
    enabled: open,
  });

  return (
    <RecordPicker<Subject>
      open={open}
      onClose={onClose}
      title="Choose a subject"
      description="One subject record is shared by every curriculum that uses it."
      items={query.data ?? []}
      isLoading={query.isLoading}
      error={query.error}
      selectedId={selectedId}
      getId={(subject) => subject.id}
      getPrimary={(subject) => subject.code + ' — ' + subject.title}
      getSecondary={(subject) =>
        subject.units + ' units · ' + subject.lectureHours + 'h lecture · ' + subject.labHours + 'h lab'
      }
      getSearchText={(subject) => subject.code + ' ' + subject.title}
      onSelect={onSelect}
      searchPlaceholder="Search subject code or title…"
    />
  );
}

export function SectionPicker({
  open,
  onClose,
  onSelect,
  selectedId,
  programId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (section: SectionView) => void;
  selectedId?: string | null;
  programId?: string;
}) {
  const query = useQuery({
    queryKey: ['sections', programId ?? 'all'],
    queryFn: () => catalogApi.listSections(programId),
    enabled: open,
  });

  return (
    <RecordPicker<SectionView>
      open={open}
      onClose={onClose}
      title="Choose a section"
      items={query.data ?? []}
      isLoading={query.isLoading}
      error={query.error}
      selectedId={selectedId}
      getId={(section) => section.id}
      getPrimary={(section) => section.code}
      getSecondary={(section) =>
        section.programName + ' · Year ' + section.yearLevel + ' · capacity ' + section.capacity
      }
      getTrailing={(section) => section.studentCount + ' students'}
      getSearchText={(section) =>
        section.code + ' ' + section.programCode + ' ' + section.programName
      }
      onSelect={onSelect}
      searchPlaceholder="Search section or program…"
    />
  );
}
