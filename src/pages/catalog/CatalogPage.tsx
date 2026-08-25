import { useState } from 'react';
import { PageHeader, Tabs } from '@/components/ui';
import { ProgramsPanel } from './ProgramsPanel';
import { CurriculaPanel } from './CurriculaPanel';
import { SubjectsPanel } from './SubjectsPanel';
import { SectionsPanel } from './SectionsPanel';
import { FacultyPanel } from './FacultyPanel';

type CatalogTab = 'PROGRAMS' | 'CURRICULA' | 'SUBJECTS' | 'SECTIONS' | 'FACULTY';

/**
 * Academic catalog.
 *
 * Records are deactivated rather than deleted, because enrollments and
 * grades point at them and history must keep resolving.
 */
export function CatalogPage() {
  const [tab, setTab] = useState<CatalogTab>('PROGRAMS');
  const canWrite = true;

  return (
    <>
      <PageHeader
        title="Academic Catalog"
        description="Programs, curricula, subjects, sections, faculty, and the mapping that puts a subject into a curriculum at a year level and term."
      />

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
            { value: 'FACULTY', label: 'Faculty' },
          ]}
        />
      </div>

      {tab === 'PROGRAMS' ? <ProgramsPanel canWrite={canWrite} /> : null}
      {tab === 'CURRICULA' ? <CurriculaPanel canWrite={canWrite} /> : null}
      {tab === 'SUBJECTS' ? <SubjectsPanel canWrite={canWrite} /> : null}
      {tab === 'SECTIONS' ? <SectionsPanel canWrite={canWrite} /> : null}
      {tab === 'FACULTY' ? <FacultyPanel /> : null}
    </>
  );
}
