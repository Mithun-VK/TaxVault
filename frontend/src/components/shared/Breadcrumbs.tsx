import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Location trail for the drill-down hierarchies (Assets → Owner → Detail,
 * Taxes/Bills → Category). The last crumb is the current page; earlier crumbs
 * are one-click hops back up.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.to && !last ? (
                  <Link
                    to={item.to}
                    className="rounded text-slate-700 transition-colors hover:text-brand-navy"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={last ? 'font-medium text-slate-800' : 'text-slate-700'} aria-current={last ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
