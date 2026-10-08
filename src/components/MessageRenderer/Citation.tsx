import * as Tooltip from '@radix-ui/react-tooltip';
import ExternalAnchor from '../ExternalAnchor';
import { useSetActiveSource, useSources } from '../SourcesContext';
import SourceFavicon from '../SourceFavicon';
import { sourceSiteName, sourceSnippet, sourceTitle } from '@/lib/utils/source';

const Citation = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  const sources = useSources();
  const setActiveSource = useSetActiveSource();

  const index = parseInt(String(children), 10) - 1;
  const source = sources[index];

  const link = (
    <ExternalAnchor
      href={href}
      onMouseEnter={() => source && setActiveSource(index)}
      onMouseLeave={() => setActiveSource(null)}
      className="bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors duration-150 relative"
    >
      {children}
    </ExternalAnchor>
  );

  if (!source) return link;

  const snippet = sourceSnippet(source, 180);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-72 rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-3 shadow-lg"
        >
          <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
            <SourceFavicon source={source} />
            <span className="truncate">{sourceSiteName(source)}</span>
            <span className="ml-auto shrink-0">{index + 1}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-black dark:text-white">
            {sourceTitle(source)}
          </p>
          {snippet && (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-black/60 dark:text-white/60">
              {snippet}
            </p>
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export default Citation;
