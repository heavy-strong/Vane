'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chunk } from '@/lib/types';
import { usePersistedToggle } from '@/lib/hooks/usePersistedToggle';
import {
  isFileSource,
  sourceSiteName,
  sourceSnippet,
  sourceTitle,
} from '@/lib/utils/source';
import { useActiveSource, useSetActiveSource } from './SourcesContext';
import SourceFavicon from './SourceFavicon';
import ExternalAnchor from './ExternalAnchor';

const SourcesPanel = ({
  sources,
  onShowAll,
}: {
  sources: Chunk[];
  onShowAll: () => void;
}) => {
  const [open, toggleOpen] = usePersistedToggle('sourcesPanelOpen', true);
  const active = useActiveSource();
  const setActive = useSetActiveSource();
  const listRef = useRef<HTMLDivElement | null>(null);
  const hoveringList = useRef(false);

  // Bring the source of a hovered citation into view. Scrolls only the list
  // itself; scrollIntoView could also move the page under the cursor.
  useEffect(() => {
    const list = listRef.current;
    if (active === null || !list || hoveringList.current) return;

    const item = list.querySelector<HTMLElement>(
      `[data-source-index="${active}"]`,
    );
    if (!item) return;

    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;

    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({
        top: top - (list.clientHeight - item.offsetHeight) / 2,
        behavior: 'smooth',
      });
    }
  }, [active]);

  return (
    <div className="w-full rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary">
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        <button
          onClick={onShowAll}
          className="flex items-center gap-2 text-sm font-medium text-black/80 dark:text-white/80 hover:text-black dark:hover:text-white transition-colors duration-150"
          title="Show all sources"
        >
          Sources
          <span className="rounded-full bg-light-secondary dark:bg-dark-secondary px-1.5 py-0.5 text-[11px] font-normal text-black/60 dark:text-white/60">
            {sources.length}
          </span>
        </button>
        <button
          onClick={toggleOpen}
          className="ml-auto rounded-md p-1 text-black/50 dark:text-white/50 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white transition-colors duration-150"
          aria-label={open ? 'Collapse sources' : 'Expand sources'}
          aria-expanded={open}
        >
          <ChevronDown
            size={16}
            className={cn(
              'transition-transform duration-150',
              !open && '-rotate-90',
            )}
          />
        </button>
      </div>

      {open ? (
        <div
          ref={listRef}
          onMouseEnter={() => (hoveringList.current = true)}
          onMouseLeave={() => (hoveringList.current = false)}
          className="relative max-h-[calc(100vh-14rem)] overflow-y-auto px-2 pb-2"
        >
          {sources.map((source, i) => {
            const snippet = sourceSnippet(source, 140);

            return (
              <ExternalAnchor
                key={i}
                href={source.metadata.url}
                data-source-index={i}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={(e) => isFileSource(source) && e.preventDefault()}
                className={cn(
                  'group block rounded-xl px-2 py-2.5 transition-colors duration-150',
                  active === i
                    ? 'bg-light-secondary dark:bg-dark-secondary'
                    : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                  isFileSource(source) && 'cursor-default',
                )}
              >
                <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
                  <SourceFavicon source={source} />
                  <span className="truncate">{sourceSiteName(source)}</span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded px-1 tabular-nums transition-colors duration-150',
                      active === i
                        ? 'bg-[#24A0ED] text-white'
                        : 'bg-light-secondary dark:bg-dark-secondary',
                    )}
                  >
                    {i + 1}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-black dark:text-white">
                  {sourceTitle(source)}
                </p>
                {snippet && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-black/50 dark:text-white/50">
                    {snippet}
                  </p>
                )}
              </ExternalAnchor>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1 px-4 pb-3">
          {sources.slice(0, 8).map((source, i) => (
            <SourceFavicon key={i} source={source} />
          ))}
          {sources.length > 8 && (
            <span className="ml-1 text-xs text-black/50 dark:text-white/50">
              +{sources.length - 8}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SourcesPanel;
