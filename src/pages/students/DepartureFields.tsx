import type { DepartureReason } from '@/types';
import { ALL_DEPARTURE_REASONS, DEPARTURE_REASON_LABELS, isInstitutionInitiated } from '@/types';
import { Field, InfoNote, Select, TextArea } from '@/components/ui';

/** What a caller holds while the registrar fills this in. */
export interface DepartureDraft {
  reason: DepartureReason | '';
  note: string;
}

export const EMPTY_DEPARTURE: DepartureDraft = { reason: '', note: '' };

/**
 * True once the draft is good enough for the server to accept, so a caller
 * can disable its own submit button rather than letting the request fail.
 * Mirrors `setStudentStatus`'s rule — the server is still the enforcement.
 */
export function isDepartureComplete(draft: DepartureDraft): boolean {
  if (!draft.reason) return false;
  if (draft.reason === 'OTHER' && !draft.note.trim()) return false;
  return true;
}

/**
 * Why a trainee stopped — the reason and the registrar's own words.
 *
 * Shared by every screen that can drop somebody, so the three of them cannot
 * drift into asking three different questions. Rendered inline rather than as
 * its own modal: the reason belongs in the same breath as the decision, not
 * in a second dialog after it.
 */
export function DepartureFields({
  value,
  onChange,
  disabled,
}: {
  value: DepartureDraft;
  onChange: (next: DepartureDraft) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field
        label="Why are they stopping?"
        hint="This is what separates a trainee the centre removed from one who left of their own accord — the two halves of any retention figure."
      >
        <Select
          value={value.reason}
          disabled={disabled}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...value, reason: event.target.value as DepartureReason | '' })
          }
        >
          <option value="">Choose a reason…</option>
          {ALL_DEPARTURE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {DEPARTURE_REASON_LABELS[reason]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={value.reason === 'OTHER' ? 'What happened? (required)' : 'Note (optional)'}
        hint="Detail the reason code cannot carry — a date, a destination school, a reference to a clearance form."
      >
        <TextArea
          rows={2}
          maxLength={500}
          disabled={disabled}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder={
            value.reason === 'TRANSFERRED_OUT'
              ? 'e.g. Transferred to TESDA RTC Cebu, clearance issued 12 Sep 2026.'
              : 'e.g. Submitted a withdrawal form on 10 Sep 2026.'
          }
        />
      </Field>

      {value.reason ? (
        <InfoNote tone="info" title="How this will be counted">
          {isInstitutionInitiated(value.reason)
            ? 'Recorded as ended by the centre — an academic outcome, reported separately from trainees who chose to leave.'
            : 'Recorded as ended by the trainee — attrition, reported separately from trainees the centre removed.'}
        </InfoNote>
      ) : null}
    </div>
  );
}
