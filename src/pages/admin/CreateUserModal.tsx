import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@/types';
import { ALL_ROLES, ROLE_LABELS } from '@/types';
import { usersApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, TextInput } from '@/components/ui';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker } from '@/components/pickers';

export function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('REGISTRAR');
  const [student, setStudent] = useState<StudentView | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [studentPicker, setStudentPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('REGISTRAR');
    setStudent(null);
    setAdminPassword('');
    setError(null);
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        email,
        password,
        firstName,
        lastName,
        role,
        studentId: role === 'TRAINEE' ? (student?.id ?? null) : null,
        adminPassword,
      }),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        'Account created for ' + user.email + '.',
        'It starts as Pending Review and cannot sign in until approved.',
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const ready =
    email &&
    password.length >= 8 &&
    firstName &&
    lastName &&
    adminPassword &&
    (role !== 'TRAINEE' || student);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="New user account"
        description="New accounts start as Pending Review."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!ready}
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              Create account
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="nu-fn" required>
            <TextInput id="nu-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="nu-ln" required>
            <TextInput id="nu-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="nu-em" required className="sm:col-span-2">
            <TextInput
              id="nu-em"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@rtc-korphil.example.ph"
            />
          </Field>
          <Field
            label="Password"
            htmlFor="nu-pw"
            required
            hint="At least 8 characters."
            error={password && password.length < 8 ? 'Too short.' : null}
          >
            <TextInput
              id="nu-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Role" htmlFor="nu-role" required>
            <Select id="nu-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ALL_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          {role === 'TRAINEE' ? (
            <div className="sm:col-span-2">
              <PickerButton
                label="Linked student record (required)"
                value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
                placeholder="Search by name or student number…"
                onClick={() => setStudentPicker(true)}
                onClear={() => setStudent(null)}
              />
            </div>
          ) : null}

          <Field
            label="Your password"
            htmlFor="nu-admin"
            required
            className="sm:col-span-2"
            hint="Every account change requires you to re-authenticate."
          >
            <TextInput
              id="nu-admin"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </Field>
        </div>

        {error ? (
          <div className="mt-4">
            <InfoNote tone="danger">{error}</InfoNote>
          </div>
        ) : null}
      </Modal>

      <StudentPicker
        open={studentPicker}
        onClose={() => setStudentPicker(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />
    </>
  );
}
