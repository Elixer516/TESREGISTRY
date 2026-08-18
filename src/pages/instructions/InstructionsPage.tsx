import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, InfoNote, PageHeader, TextInput } from '@/components/ui';
import { EmptyState } from '@/components/states';
import { classNames } from '@/lib/format';
import { WALKTHROUGHS, type Walkthrough } from './walkthroughs';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
      {children}
    </h3>
  );
}

function searchableText(walkthrough: Walkthrough): string {
  return [
    walkthrough.title,
    walkthrough.summary,
    walkthrough.overview,
    ...walkthrough.prerequisites,
    ...walkthrough.flow,
    ...walkthrough.steps.flatMap((step) => [step.title, step.detail]),
    ...walkthrough.mistakes,
    ...walkthrough.troubleshooting.flatMap((item) => [item.problem, item.fix]),
    ...walkthrough.reminders,
  ].join(' ');
}

/**
 * Registrar Instructions Center.
 *
 * Each walkthrough is collapsible and every step deep-links to the screen it
 * describes, so the guide is usable while doing the work rather than only
 * before it.
 */
export function InstructionsPage() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(WALKTHROUGHS[0]?.id ?? null);
  const [openStep, setOpenStep] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return WALKTHROUGHS;
    return WALKTHROUGHS.filter((walkthrough) =>
      searchableText(walkthrough).toLowerCase().includes(needle),
    );
  }, [search]);

  return (
    <>
      <PageHeader
        title="Registrar Instructions Center"
        description="Five walkthroughs for the tasks that carry real rules. Each step links straight to the screen it happens on."
      />

      <Card className="mb-4 p-4">
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the guides — try INC, curriculum, conflict, transferee…"
          aria-label="Search walkthroughs"
        />
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="No walkthrough matches"
          hint="Try a shorter term, or clear the search to see all five guides."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((walkthrough) => {
            const expanded = openId === walkthrough.id;
            return (
              <Card key={walkthrough.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenId(expanded ? null : walkthrough.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-900">
                      {walkthrough.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">{walkthrough.summary}</span>
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-400">
                    {expanded ? '−' : '+'}
                  </span>
                </button>

                {expanded ? (
                  <div className="space-y-5 border-t border-line px-4 py-4">
                    <section>
                      <SectionTitle>Overview</SectionTitle>
                      <p className="text-sm leading-relaxed text-ink-700">{walkthrough.overview}</p>
                    </section>

                    <section>
                      <SectionTitle>Before you start</SectionTitle>
                      <ul className="list-inside list-disc space-y-1 text-sm text-ink-700">
                        {walkthrough.prerequisites.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <SectionTitle>The flow</SectionTitle>
                      <ol className="flex flex-wrap items-center gap-1.5">
                        {walkthrough.flow.map((stage, index) => (
                          <li key={stage} className="flex items-center gap-1.5">
                            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-700">
                              <span
                                aria-hidden
                                className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white"
                              >
                                {index + 1}
                              </span>
                              {stage}
                            </span>
                            {index < walkthrough.flow.length - 1 ? (
                              <span aria-hidden className="text-ink-400">
                                →
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </section>

                    <section>
                      <SectionTitle>Steps</SectionTitle>
                      <ol className="space-y-2">
                        {walkthrough.steps.map((step, index) => {
                          const key = walkthrough.id + '-' + index;
                          const stepOpen = openStep === key;
                          return (
                            <li key={key} className="rounded-lg border border-line">
                              <button
                                type="button"
                                aria-expanded={stepOpen}
                                onClick={() => setOpenStep(stepOpen ? null : key)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                              >
                                <span
                                  aria-hidden
                                  className={classNames(
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                    stepOpen ? 'bg-brand text-white' : 'bg-surface-2 text-ink-500',
                                  )}
                                >
                                  {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">
                                  {step.title}
                                </span>
                                <span aria-hidden className="text-ink-400">
                                  {stepOpen ? '−' : '+'}
                                </span>
                              </button>
                              {stepOpen ? (
                                <div className="border-t border-line px-3 py-3">
                                  <p className="text-sm leading-relaxed text-ink-700">
                                    {step.detail}
                                  </p>
                                  <Link to={step.link} className="mt-2.5 inline-block">
                                    <Button size="sm" variant="secondary">
                                      {step.linkLabel}
                                    </Button>
                                  </Link>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    </section>

                    <section>
                      <SectionTitle>Common mistakes</SectionTitle>
                      <ul className="space-y-1.5">
                        {walkthrough.mistakes.map((item) => (
                          <li
                            key={item}
                            className="rounded-md border-l-2 border-warning bg-warning-soft px-3 py-2 text-sm text-warning-ink"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <SectionTitle>Troubleshooting</SectionTitle>
                      <dl className="space-y-2">
                        {walkthrough.troubleshooting.map((item) => (
                          <div key={item.problem} className="rounded-lg border border-line p-3">
                            <dt className="text-sm font-medium text-ink-900">{item.problem}</dt>
                            <dd className="mt-0.5 text-sm text-ink-500">{item.fix}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <InfoNote tone="info" title="Remember">
                      <ul className="list-inside list-disc space-y-0.5">
                        {walkthrough.reminders.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </InfoNote>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
