import { RotateCcw } from 'lucide-react';
import { MediaStatus } from '@/lib/hooks/useMediaSearch';

/** Loading, empty and error states shared by the Images and Videos tabs. */
const MediaState = ({
  status,
  empty,
  onRetry,
}: {
  status: MediaStatus;
  empty: string;
  onRetry: () => void;
}) => {
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="aspect-video w-full rounded-xl bg-light-secondary dark:bg-dark-secondary animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-sm text-black/50 dark:text-white/50">
      <p>
        {status === 'error' ? 'Something went wrong while searching.' : empty}
      </p>
      {status === 'error' && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg border border-light-200 dark:border-dark-200 px-3 py-1.5 text-black/70 dark:text-white/70 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-150"
        >
          <RotateCcw size={14} />
          Try again
        </button>
      )}
    </div>
  );
};

export default MediaState;
