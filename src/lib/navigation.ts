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
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '▦',
    roles: ['REGISTRAR', 'TRAINING_OFFICER', 'TRAINER', 'IT_ADMIN'],
    description: 'Overview of the centre',
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: '🔔',
    roles: ['REGISTRAR', 'TRAINING_OFFICER', 'TRAINER', 'IT_ADMIN'],
    description: 'Messages addressed to you',
  },
  {
    to: '/students',
    label: 'Students',
    icon: '👥',
    roles: ['REGISTRAR'],
    description: 'Applications, approvals and records',
  },
  {
    to: '/enrollment',
    label: 'Enrollment',
    icon: '📝',
    roles: ['REGISTRAR'],
    description: 'Enroll students into a term',
  },
  {
    to: '/grades',
    label: 'Grades',
    icon: '✎',
    roles: ['REGISTRAR', 'TRAINER'],
    description: 'Encode grades by class or by student',
  },
  {
    to: '/records',
    label: 'Academic Records',
    icon: '📚',
    roles: ['REGISTRAR'],
    description: 'History, INC handling and grade sheets',
  },
  {
    to: '/documents',
    label: 'Documents',
    icon: '📄',
    roles: ['REGISTRAR'],
    description: 'Requests, generation and release',
  },
  {
    to: '/gsa',
    label: 'GSA',
    icon: '∑',
    roles: ['REGISTRAR'],
    description: 'General Scholastic Average',
  },
  {
    to: '/transcripts',
    label: 'Transcript Upload',
    icon: '⬆',
    roles: ['REGISTRAR'],
    description: 'Previous-school PDFs and credited subjects',
  },
  {
    to: '/catalog',
    label: 'Academic Catalog',
    icon: '🏷',
    roles: ['TRAINING_OFFICER', 'REGISTRAR'],
    description: 'Programs, curricula, subjects and sections',
  },
  {
    to: '/terms',
    label: 'School Years & Terms',
    icon: '📅',
    roles: ['REGISTRAR'],
    description: 'Set the active term',
  },
  {
    to: '/schedules',
    label: 'Class Schedules',
    icon: '🗓',
    roles: ['TRAINING_OFFICER', 'REGISTRAR', 'TRAINER'],
    description: 'Weekly grid, drafts and publishing',
  },
  {
    to: '/availability',
    label: 'Trainer Availability',
    icon: '⏱',
    roles: ['TRAINER', 'TRAINING_OFFICER'],
    description: 'Preferred days and times per term',
  },
  {
    to: '/users',
    label: 'User Accounts',
    icon: '🔑',
    roles: ['IT_ADMIN'],
    description: 'Create, approve and suspend logins',
  },
  {
    to: '/audit',
    label: 'Audit Log',
    icon: '🕮',
    roles: ['IT_ADMIN'],
    description: 'Every recorded action',
  },
  {
    to: '/instructions',
    label: 'Instructions Center',
    icon: '❓',
    roles: ['REGISTRAR'],
    description: 'Step-by-step walkthroughs',
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
    to: '/portal/notifications',
    label: 'Notifications',
    icon: '🔔',
    roles: ['TRAINEE'],
    description: 'Messages addressed to you',
  },
  {
    to: '/portal/schedule',
    label: 'My Schedule',
    icon: '🗓',
    roles: ['TRAINEE'],
    description: 'Your weekly classes',
  },
  {
    to: '/portal/records',
    label: 'My Grades',
    icon: '📚',
    roles: ['TRAINEE'],
    description: 'Your academic record',
  },
  {
    to: '/portal/requests',
    label: 'Document Requests',
    icon: '📄',
    roles: ['TRAINEE'],
    description: 'Ask the Registrar for a document',
  },
];

export function navItemsFor(role: Role): NavItem[] {
  if (role === 'TRAINEE') return TRAINEE_NAV;
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Where a role lands after signing in. */
export function landingRouteFor(role: Role): string {
  return role === 'TRAINEE' ? '/portal' : '/dashboard';
}

export function canAccess(role: Role, path: string): boolean {
  if (role === 'TRAINEE') return path.startsWith('/portal');
  const item = NAV_ITEMS.find((nav) => path === nav.to || path.startsWith(`${nav.to}/`));
  if (!item) return true;
  return item.roles.includes(role);
}
