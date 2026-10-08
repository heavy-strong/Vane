/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { File, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chunk } from '@/lib/types';
import { faviconUrl, isFileSource } from '@/lib/utils/source';

const SourceFavicon = ({
  source,
  className,
}: {
  source: Chunk;
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const Fallback = isFileSource(source) ? File : Globe;

  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-light-200 dark:bg-dark-200',
        className,
      )}
    >
      {isFileSource(source) || failed ? (
        <Fallback size={10} className="text-black/60 dark:text-white/60" />
      ) : (
        <img
          src={faviconUrl(source.metadata.url)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
};

export default SourceFavicon;
