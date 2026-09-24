/**
 * The pieces every report sheet is built from, so the five reports read and
 * print as one family: the centre's header, headline figures, numeric
 * cells, section headings and the signature block.
 */

import type { ReactNode } from 'react';
import { INSTITUTION, SIGNATORIES } from '@/config/institution';
import { formatDateTime, signatureName } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { Td } from '@/components/ui';
import korphilLogo from '@/assets/korphil-logo.png';

export function ReportHeader({
  title,
  subtitle,
  generatedAt,
}: {
  title: string;
  subtitle: string;
  generatedAt: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line pb-3">
      <img src={korphilLogo} alt="" aria-hidden className="h-12 w-12 shrink-0 object-contain" />
      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs font-semibold uppercase text-ink-700">{INSTITUTION.agency}</p>
        <p className="text-xs text-ink-500">{INSTITUTION.centre}</p>
        <p className="mt-1 text-base font-bold uppercase tracking-wide text-ink-900">{title}</p>
        <p className="text-xs text-ink-700">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right text-[11px] text-ink-500">
        <p>Run date:</p>
        <p>{formatDateTime(generatedAt)}</p>
      </div>
    </div>
  );
}

export function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="text-[10px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Figures({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

export function Num({ value, strong }: { value: ReactNode; strong?: boolean }) {
  return (
    <Td className={'text-right tabular-nums ' + (strong ? 'font-bold text-ink-900' : 'text-ink-700')}>
      {value}
    </Td>
  );
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-700">{children}</h3>
      {note ? <p className="text-[10px] text-ink-500">{note}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line p-5 text-center text-sm text-ink-500">
      {children}
    </p>
  );
}

/** "Prepared by" is whoever is signed in; "Noted by" the Center Administrator. */
export function ReportSignatures() {
  const { user } = useAuth();
  const staff = user && user.role !== 'TRAINEE';
  return (
    <div className="grid gap-8 break-inside-avoid pt-4 text-[11px] sm:grid-cols-2">
      <Sign
        caption="Prepared by"
        name={staff ? signatureName(user) : SIGNATORIES.registrarName}
        title={staff ? user.position : SIGNATORIES.registrarTitle}
      />
      <Sign caption="Noted by" name={SIGNATORIES.centerAdminName} title={SIGNATORIES.centerAdminTitle} />
    </div>
  );
}

function Sign({ caption, name, title }: { caption: string; name: string; title: string }) {
  return (
    <div>
      <p className="text-ink-500">{caption}:</p>
      <p className="mt-6 border-t border-ink-900 pt-1 font-semibold uppercase text-ink-900">{name}</p>
      <p className="text-ink-500">{title}</p>
    </div>
  );
}

/** "82.5%", or a dash when there was nothing to divide. */
export function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export type CsvRow = Array<string | number | null>;

/** Downloads rows as a UTF-8 CSV that Excel opens with accents intact. */
export function downloadCsv(fileName: string, rows: CsvRow[]) {
  const cell = (value: string | number | null) => {
    const text = value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
