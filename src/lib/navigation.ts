/**
 * Navigation and role routing.
 *
 * This decides what a role *sees*. It is not a security boundary — the service
 * layer in `src/server` independently refuses anything a role may not do.
 */

import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[];
  description: string;
  /** Groups the sidebar into labelled sections. Ungrouped items render as a flat list. */
  group?: string;
  /** Shown to a trainer only when they head a diploma. */
  headOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '▦',
    roles: ['REGISTRAR'],
    description: 'Overview of the centre',
    group: 'Overview',
  },
  {
    to: '/students',
    label: 'Students',
    icon: '👥',
    roles: ['REGISTRAR'],
    description: 'Applications, approvals and records',
    group: 'Students & Enrollment',
  },
  {
    to: '/drops',
    label: 'Drops',
    icon: '🚫',
    roles: ['REGISTRAR'],
    description: 'Dropping trainees from their diploma, with reason and proof',
    group: 'Students & Enrollment',
  },
  {
    to: '/crediting',
    label: 'Crediting',
    icon: '🎓',
    roles: ['REGISTRAR'],
    description: 'Credit a college undergraduate’s earlier subjects',
    group: 'Students & Enrollment',
  },
  {
    to: '/enrollment',
    label: 'Enrollment',
    icon: '📝',
    roles: ['REGISTRAR'],
    description: 'Enroll students into a term',
    group: 'Students & Enrollment',
  },
  {
    // One route, two jobs: a trainer sees their own sheets to fill in, the
    // registrar sees the review queue. Which, is decided by the service.
    to: '/grading-sheets',
    label: 'Grading Sheets',
    icon: '🗒',
    roles: ['REGISTRAR', 'TRAINER'],
    description: 'Submit and review class grades',
    group: 'Academics',
  },
  {
    // Trainer-only: the registrar's equivalent is the full Class Schedules
    // screen, which covers every diploma rather than one trainer's own week.
    to: '/my-schedule',
    label: 'My Schedule',
    icon: '🗓',
    roles: ['TRAINER'],
    description: 'Your weekly teaching timetable',
    group: 'Academics',
  },
  {
    to: '/diploma-grades',
    label: 'Diploma Grades',
    icon: '🏫',
    roles: ['TRAINER'],
    description: 'Every class and trainee of the diploma you head',
    group: 'Academics',
    headOnly: true,
  },
  {
    to: '/my-evaluations',
    label: 'My Evaluation Results',
    icon: '✎',
    roles: ['TRAINER'],
    description: 'How trainees rated your classes, after each term',
    group: 'Academics',
  },
  {
    to: '/catalog',
    label: 'Academic Catalog',
    icon: '🏷',
    roles: ['REGISTRAR'],
    description: 'Programs, curricula, subjects and sections',
    group: 'Academics',
  },
  {
    to: '/terms',
    label: 'School Years & Semesters',
    icon: '📅',
    roles: ['REGISTRAR'],
    description: 'Create and open semesters per Diploma',
    group: 'Academics',
  },
  {
    to: '/schedules',
    label: 'Class Schedules',
    icon: '🗓',
    roles: ['REGISTRAR'],
    description: 'Weekly grid, drafts and publishing',
    group: 'Scheduling',
  },
  {
    to: '/evaluation',
    label: 'Grade Evaluation',
    icon: '📚',
    roles: ['REGISTRAR'],
    description: 'Full record of a trainee, and INC resolution',
    group: 'Academics',
  },
  {
    to: '/cor',
    label: 'COR',
    icon: '📋',
    roles: ['REGISTRAR'],
    description: 'Certificate of Registration',
    group: 'Documents',
  },
  {
    to: '/transcript',
    label: 'Transcript & Graduation',
    icon: '📜',
    roles: ['REGISTRAR'],
    description: 'Mark graduation with the SO number and print the TOR',
    group: 'Documents',
  },
  {
    to: '/document-requests',
    label: 'Document Requests',
    icon: '📨',
    roles: ['REGISTRAR'],
    description: 'Documents trainees asked for from their portal',
    group: 'Documents',
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: '📊',
    roles: ['REGISTRAR'],
    description: 'Enrollment and other reports, printable and exportable',
    group: 'Documents',
  },
  {
    to: '/users',
    label: 'User Management',
    icon: '🔑',
    roles: ['IT_ADMIN'],
    description: 'Create and deactivate accounts, assign roles, reset passwords',
    group: 'Administration',
  },
  {
    to: '/audit',
    label: 'Audit Log',
    icon: '🕮',
    roles: ['REGISTRAR', 'IT_ADMIN'],
    description: 'Every recorded action',
    group: 'Administration',
  },
  {
    to: '/instructions',
    label: 'Instructions Center',
    icon: '❓',
    roles: ['REGISTRAR', 'TRAINER'],
    description: 'Step-by-step walkthroughs',
    group: 'Help',
  },
];

export const TRAINEE_NAV: NavItem[] = [
  {
    to: '/portal',
    label: 'Home',
    icon: '▦',
    roles: ['TRAINEE'],
    description: 'Your program at a glance',
  },
  {
    to: '/portal/schedule',
    label: 'My Schedule',
    icon: '🗓',
    roles: ['TRAINEE'],
    description: 'Your weekly classes',
  },
  {
    to: '/portal/grades',
    label: 'My Grades',
    icon: '📚',
    roles: ['TRAINEE'],
    description: 'Your academic record',
  },
];

export function navItemsFor(role: Role): NavItem[] {
  if (role === 'TRAINEE') return TRAINEE_NAV;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Where a role lands after signing in.
 *
 * A trainer has exactly one job in this system — submitting grades — so they
 * land on it rather than on a dashboard that would be empty for them.
 */
export function landingRouteFor(role: Role): string {
  if (role === 'TRAINEE') return '/portal';
  if (role === 'TRAINER') return '/grading-sheets';
  if (role === 'IT_ADMIN') return '/users';
  return '/dashboard';
}

export function canAccess(role: Role, path: string): boolean {
  if (role === 'TRAINEE') return path.startsWith('/portal');
  const item = NAV_ITEMS.find((nav) => path === nav.to || path.startsWith(`${nav.to}/`));
  // Unknown paths stay open for the registrar, but a trainer or the IT
  // Administrator is confined to what is explicitly listed for them — staff
  // with a narrow remit.
  if (!item) return role === 'REGISTRAR';
  return item.roles.includes(role);
}
