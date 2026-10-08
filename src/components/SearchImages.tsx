/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { MediaStatus } from '@/lib/hooks/useMediaSearch';
import { sourceHost } from '@/lib/utils/source';
import MediaState from './MediaState';

export type SearchImage = {
  url: string;
  img_src: string;
  title: string;
};

/** The image results for a message, shown in its Images tab. */
const SearchImages = ({
  images,
  status,
  onRetry,
}: {
  images: SearchImage[];
  status: MediaStatus;
  onRetry: () => void;
}) => {
  const [index, setIndex] = useState(-1);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  // Hosts like Naver refuse hotlinked images (403), so whatever still fails
  // to load is dropped instead of showing as a broken icon.
  const visible = images.filter((image) => !failed.has(image.img_src));

  if (status !== 'done' || visible.length === 0) {
    return (
      <MediaState
        status={status}
        empty="No images found for this question."
        onRetry={onRetry}
      />
    );
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-2 [&>*]:mb-2">
        {visible.map((image, i) => (
          <button
            key={`${image.img_src}-${image.url}`}
            onClick={() => setIndex(i)}
            className="group relative block w-full overflow-hidden rounded-xl bg-light-secondary dark:bg-dark-secondary break-inside-avoid cursor-zoom-in"
          >
            <img
              src={image.img_src}
              alt={image.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() =>
                setFailed((prev) => new Set(prev).add(image.img_src))
              }
              className="w-full object-cover transition duration-200 group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <p className="truncate text-xs text-white">{image.title}</p>
              <p className="truncate text-[11px] text-white/70">
                {sourceHost(image.url)}
              </p>
            </div>
          </button>
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        index={Math.max(index, 0)}
        close={() => setIndex(-1)}
        carousel={{ imageProps: { referrerPolicy: 'no-referrer' } }}
        slides={visible.map((image) => ({
          src: image.img_src,
          alt: image.title,
        }))}
      />
    </>
  );
};

export default SearchImages;
