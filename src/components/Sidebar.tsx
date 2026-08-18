import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/lib/navigation';
import { INSTITUTION } from '@/config/institution';
import { classNames } from '@/lib/format';
import { SidebarSupport } from './SidebarSupport';

/**
 * Sidebar navigation.
 *
 * Three shapes from one component: a full rail on desktop, an icon-only rail
 * with tooltips when collapsed, and a slide-in drawer on small screens. The
 * collapsed choice is remembered by the layout that owns this.
 */
export function Sidebar({
  items,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  items: NavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const width = collapsed ? 'lg:w-16' : 'lg:w-64';

  return (
    <>
      {/* Scrim for the mobile drawer */}
      {mobileOpen ? (
        <div
          className="no-print fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      ) : null}

      <aside
        className={classNames(
          'no-print fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200',
          // On desktop the sidebar stays pinned to the viewport as the page
          // scrolls, rather than scrolling away with the main content.
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-[width]',
          width,
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div
          className={classNames(
            'flex items-center gap-2.5 border-b border-line px-3 py-3',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white"
          >
            RS
          </span>
          <span className={classNames('min-w-0', collapsed && 'lg:hidden')}>
            <span className="block truncate text-sm font-semibold text-ink-900">
              {INSTITUTION.systemName}
            </span>
            <span className="block truncate text-[11px] text-ink-500">
              {INSTITUTION.centreShort}
            </span>
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto rounded px-2 py-1 text-ink-500 hover:bg-surface-2 lg:hidden"
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/portal'}
                  onClick={onCloseMobile}
                  title={collapsed ? `${item.label} — ${item.description}` : item.description}
                  className={({ isActive }) =>
                    classNames(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      collapsed && 'lg:justify-center lg:px-2',
                      isActive
                        ? 'bg-brand text-white'
                        : 'text-ink-700 hover:bg-surface-2 hover:text-ink-900',
                    )
                  }
                >
                  <span aria-hidden className="w-5 shrink-0 text-center text-base">
                    {item.icon}
                  </span>
                  <span className={classNames('truncate', collapsed && 'lg:hidden')}>
                    {item.label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <SidebarSupport collapsed={collapsed} />

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden items-center justify-center gap-2 border-t border-line px-3 py-2 text-xs font-medium text-ink-500 hover:bg-surface-2 hover:text-ink-900 lg:flex"
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
        >
          <span aria-hidden>{collapsed ? '»' : '«'}</span>
          <span className={classNames(collapsed && 'lg:hidden')}>Collapse</span>
        </button>
      </aside>
    </>
  );
}
