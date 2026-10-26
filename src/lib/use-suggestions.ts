import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '@/api';

/**
 * SO and NSTP numbers already on students' records, for AutoFillInput to
 * offer: the same SO number goes on a whole batch, and NSTP serials share
 * their prefix. Shares the Students page's cached list.
 */
export function useStudentRecordSuggestions() {
  const students = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => studentsApi.list({}),
    staleTime: 60_000,
  });
  return useMemo(() => {
    const rows = students.data ?? [];
    const pick = (values: Array<string | null | undefined>) =>
      [...new Set(values.map((v) => (v ?? '').trim()).filter(Boolean))];
    return {
      specialOrderNos: pick(rows.map((s) => s.specialOrderNo)),
      nstpSerialNos: pick(rows.map((s) => s.nstpSerialNo)),
    };
  }, [students.data]);
}
