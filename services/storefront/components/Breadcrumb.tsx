'use client';

import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { BreadcrumbJsonLd } from './ProductJsonLd';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  showJsonLd?: boolean;
  className?: string;
}

export default function Breadcrumb({
  items,
  showHome = true,
  showJsonLd = true,
  className = '',
}: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ name: 'Головна', url: '/' }, ...items]
    : items;

  return (
    <>
      {showJsonLd && <BreadcrumbJsonLd items={allItems} />}
      <nav
        aria-label="Хлібні крихти"
        className={`flex items-center text-sm ${className}`}
      >
        <ol className="flex items-center flex-wrap gap-1">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            const isHome = index === 0 && showHome;

            return (
              <li key={item.url} className="flex items-center">
                {index > 0 && (
                  <ChevronRightIcon
                    className="w-4 h-4 text-gray-400 mx-2 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span
                    className="text-gray-600 font-medium truncate max-w-[200px] sm:max-w-none"
                    aria-current="page"
                  >
                    {isHome ? (
                      <HomeIcon className="w-4 h-4" aria-label="Головна" />
                    ) : (
                      item.name
                    )}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="text-gray-500 hover:text-teal-600 transition-colors flex items-center"
                  >
                    {isHome ? (
                      <HomeIcon className="w-4 h-4" aria-label="Головна" />
                    ) : (
                      <span className="truncate max-w-[150px] sm:max-w-none">
                        {item.name}
                      </span>
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

// Compact version for mobile
export function BreadcrumbCompact({
  items,
  showHome = true,
}: Omit<BreadcrumbProps, 'showJsonLd' | 'className'>) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ name: 'Головна', url: '/' }, ...items]
    : items;

  // Show only parent and current on mobile
  const displayItems =
    allItems.length > 2
      ? [allItems[0], allItems[allItems.length - 1]]
      : allItems;

  return (
    <nav aria-label="Хлібні крихти" className="flex items-center text-sm">
      <ol className="flex items-center">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const showEllipsis = index === 0 && allItems.length > 2;

          return (
            <li key={item.url} className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon
                  className="w-4 h-4 text-gray-400 mx-1"
                  aria-hidden="true"
                />
              )}
              {showEllipsis && (
                <>
                  <Link
                    href={item.url}
                    className="text-gray-500 hover:text-teal-600"
                  >
                    <HomeIcon className="w-4 h-4" />
                  </Link>
                  <ChevronRightIcon
                    className="w-4 h-4 text-gray-400 mx-1"
                    aria-hidden="true"
                  />
                  <span className="text-gray-400">...</span>
                </>
              )}
              {!showEllipsis && (
                <>
                  {isLast ? (
                    <span className="text-gray-600 font-medium truncate max-w-[150px]">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      href={item.url}
                      className="text-gray-500 hover:text-teal-600"
                    >
                      {index === 0 ? (
                        <HomeIcon className="w-4 h-4" />
                      ) : (
                        item.name
                      )}
                    </Link>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
