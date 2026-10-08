import { cn } from '@/lib/utils';
import { Chunk } from '@/lib/types';
import {
  isFileSource,
  sourceSiteName,
  sourceSnippet,
  sourceTitle,
} from '@/lib/utils/source';
import SourceFavicon from './SourceFavicon';
import ExternalAnchor from './ExternalAnchor';

/** The full list of a message's sources, shown in its Sources tab. */
const MessageSources = ({ sources }: { sources: Chunk[] }) => (
  <div className="flex flex-col divide-y divide-light-200/70 dark:divide-dark-200/70">
    {sources.map((source, i) => {
      const snippet = sourceSnippet(source, 320);
      const file = isFileSource(source);

      return (
        <ExternalAnchor
          key={i}
          href={source.metadata.url}
          onClick={(e) => file && e.preventDefault()}
          className={cn(
            'group flex gap-3 py-4 -mx-2 px-2 rounded-xl hover:bg-light-secondary/60 dark:hover:bg-dark-secondary/60 transition-colors duration-150',
            file && 'cursor-default',
          )}
        >
          <span className="mt-0.5 h-5 min-w-5 shrink-0 rounded bg-light-secondary dark:bg-dark-secondary px-1 text-center text-xs leading-5 tabular-nums text-black/60 dark:text-white/60">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
              <SourceFavicon source={source} />
              <span className="truncate">{sourceSiteName(source)}</span>
            </div>
            <p className="mt-1 text-[15px] font-medium leading-snug text-black dark:text-white group-hover:text-[#24A0ED] transition-colors duration-150">
              {sourceTitle(source)}
            </p>
            {snippet && (
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-black/60 dark:text-white/60">
                {snippet}
              </p>
            )}
          </div>
        </ExternalAnchor>
      );
    })}
  </div>
);

export default MessageSources;
