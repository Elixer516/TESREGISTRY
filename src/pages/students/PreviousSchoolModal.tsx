import type { StudentView } from '@/types/views';
import { Button, Modal } from '@/components/ui';
import { PreviousRecordsPanel } from '../transcripts/PreviousRecordsPanel';

/**
 * "Add previous school" entry point reachable straight from a student's row,
 * rather than only from the Transcript Upload page. Wraps the same panel and
 * mutations — a credited subject entered here is the same record either way.
 */
export function PreviousSchoolModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={student ? 'Previous school — ' + student.fullName : 'Previous school'}
      description="Credited subjects entered here are what a generated transcript will show for prior schooling."
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {student ? <PreviousRecordsPanel student={student} /> : null}
    </Modal>
  );
}
