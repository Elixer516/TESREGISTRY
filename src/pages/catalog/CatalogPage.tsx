import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { InfoNote, PageHeader, Tabs } from '@/components/ui';
import { ProgramsPanel } from './ProgramsPanel';
import { CurriculaPanel } from './CurriculaPanel';
import { SubjectsPanel } from './SubjectsPanel';
import { SectionsPanel } from './SectionsPanel';

type CatalogTab = 'PROGRAMS' | 'CURRICULA' | 'SUBJECTS' | 'SECTIONS';

/**
 * Academic catalog.
 *
 * The Training Department writes it; the Registrar reads it. Records are
 * deactivated rather than deleted, because enrollments and grades point at
 * them and history must keep resolving.
 */
export function CatalogPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<CatalogTab>('PROGRAMS');
  const canWrite = role === 'TRAINING_OFFICER';

  return (
    <>
      <PageHeader
        title="Academic Catalog"
        description="Programs, curricula, subjects, sections, and the mapping that puts a subject into a curriculum at a year level and term."
      />

      {!canWrite ? (
        <div className="mb-4">
          <InfoNote tone="info" title="Read-only for your role">
            The Training Department owns the catalog. You can read everything here; changes are
            made by them.
          </InfoNote>
        </div>
      ) : null}

      <div className="mb-4">
        <Tabs<CatalogTab>
          ariaLabel="Catalog section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'PROGRAMS', label: 'Programs' },
            { value: 'CURRICULA', label: 'Curricula & mapping' },
            { value: 'SUBJECTS', label: 'Subjects' },
            { value: 'SECTIONS', label: 'Sections' },
          ]}
        />
      </div>

      {tab === 'PROGRAMS' ? <ProgramsPanel canWrite={canWrite} /> : null}
      {tab === 'CURRICULA' ? <CurriculaPanel canWrite={canWrite} /> : null}
      {tab === 'SUBJECTS' ? <SubjectsPanel canWrite={canWrite} /> : null}
      {tab === 'SECTIONS' ? <SectionsPanel canWrite={canWrite} /> : null}
    </>
  );
}
