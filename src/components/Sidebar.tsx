import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/lib/navigation';
import { INSTITUTION } from '@/config/institution';
import { classNames } from '@/lib/format';
import korphilLogo from '@/assets/korphil-logo.png';
import { SidebarSupport } from './SidebarSupport';

/** Buckets items by `group` (falling back to a single unlabelled bucket), preserving order. */
function groupItems(items: NavItem[]): Array<[string, NavItem[]]> {
  const order: string[] = [];
  const buckets = new Map<string, NavItem[]>();
  for (const item of items) {
    const key = item.group ?? '';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  return order.map((key) => [key, buckets.get(key)!]);
}

/**
 * Sidebar navigation.
 *
 * Three shapes from one component: a full rail on desktop, an icon-only rail
 * with tooltips when collapsed, and a slide-in drawer on small screens. The
 * collapsed choice is remembered by the layout that owns this.
 */
export function Sidebar({
  items,
  badges = {},
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  items: NavItem[];
  /** Counts shown as a red badge on a link, by its path. Zero shows nothing. */
  badges?: Record<string, number>;
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
          <img
            src={korphilLogo}
            alt=""
            aria-hidden
            className="h-9 w-9 shrink-0 rounded-full object-contain"
          />
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
          {groupItems(items).map(([group, groupedItems]) => (
            <div key={group} className="mb-3 last:mb-0">
              {group && !collapsed ? (
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400 first:pt-0">
                  {group}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {groupedItems.map((item) => {
                  const count = badges[item.to] ?? 0;
                  return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/portal'}
                      onClick={onCloseMobile}
                      title={collapsed ? `${item.label} — ${item.description}` : item.description}
                      aria-label={count > 0 ? `${item.label}, ${count} pending` : undefined}
                      className={({ isActive }) =>
                        classNames(
                          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
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
                      {count > 0 ? (
                        <span
                          aria-hidden
                          className={classNames(
                            // A bold red number, no circle. On the highlighted
                            // (navy) link a lighter red keeps it readable.
                            'pointer-events-none ml-auto text-sm font-extrabold leading-none text-danger group-aria-[current=page]:text-red-300',
                            // Collapsed rail: float on the icon's corner instead.
                            collapsed && 'lg:absolute lg:right-1 lg:top-0.5 lg:ml-0 lg:text-xs',
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                  );
                })}
              </ul>
            </div>
          ))}
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
