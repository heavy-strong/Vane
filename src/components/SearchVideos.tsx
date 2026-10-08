/* eslint-disable @next/next/no-img-element */
import { ExternalLink, PlayCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import Lightbox, { GenericSlide, VideoSlide } from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { MediaStatus } from '@/lib/hooks/useMediaSearch';
import { sourceHost } from '@/lib/utils/source';
import MediaState from './MediaState';

export type SearchVideo = {
  url: string;
  img_src: string;
  title: string;
  /* Missing when the engine has no embeddable player (e.g. Naver) */
  iframe_src?: string;
};

declare module 'yet-another-react-lightbox' {
  export interface VideoSlide extends GenericSlide {
    type: 'video-slide';
    src: string;
    iframe_src?: string;
    url: string;
    title: string;
  }

  interface SlideTypes {
    'video-slide': VideoSlide;
  }
}

/** The video results for a message, shown in its Videos tab. */
const SearchVideos = ({
  videos,
  status,
  onRetry,
}: {
  videos: SearchVideo[];
  status: MediaStatus;
  onRetry: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRefs = useRef<(HTMLIFrameElement | null)[]>([]);

  const slides = useMemo<VideoSlide[]>(
    () =>
      videos.map((video) => ({
        type: 'video-slide',
        iframe_src: video.iframe_src,
        src: video.img_src,
        url: video.url,
        title: video.title,
      })),
    [videos],
  );

  if (status !== 'done' || videos.length === 0) {
    return (
      <MediaState
        status={status}
        empty="No videos found for this question."
        onRetry={onRetry}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4">
        {videos.map((video, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrentIndex(i);
              setOpen(true);
            }}
            className="group flex flex-col gap-1.5 text-left"
          >
            <div className="relative w-full overflow-hidden rounded-xl bg-light-secondary dark:bg-dark-secondary">
              <img
                src={video.img_src}
                alt={video.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-video w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                <PlayCircle
                  size={36}
                  className="text-white/90 drop-shadow opacity-80 group-hover:opacity-100 transition-opacity duration-200"
                />
              </div>
            </div>
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-black dark:text-white">
              {video.title}
            </p>
            <p className="truncate text-xs text-black/50 dark:text-white/50">
              {sourceHost(video.url)}
            </p>
          </button>
        ))}
      </div>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={slides}
        index={currentIndex}
        on={{
          view: ({ index }) => {
            const previousIframe = videoRefs.current[currentIndex];
            if (previousIframe?.contentWindow) {
              previousIframe.contentWindow.postMessage(
                '{"event":"command","func":"pauseVideo","args":""}',
                '*',
              );
            }

            setCurrentIndex(index);
          },
        }}
        render={{
          slide: ({ slide }) => {
            const index = slides.findIndex((s) => s === slide);
            if (slide.type !== 'video-slide') return null;

            if (!slide.iframe_src) {
              /* No embeddable player: show the thumbnail and link out */
              return (
                <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
                  <a
                    href={slide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block"
                  >
                    <img
                      src={slide.src}
                      alt={slide.title}
                      referrerPolicy="no-referrer"
                      className="aspect-video max-h-[80vh] w-[95vw] rounded-2xl object-cover md:w-[80vw]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle
                        size={64}
                        className="text-white/90 drop-shadow"
                      />
                    </div>
                  </a>
                  <a
                    href={slide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-row items-center space-x-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
                  >
                    <span className="max-w-[70vw] truncate">{slide.title}</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
              );
            }

            const iframeSrc = slide.iframe_src;

            return (
              <div className="h-full w-full flex flex-row items-center justify-center">
                <iframe
                  src={`${iframeSrc}${iframeSrc.includes('?') ? '&' : '?'}enablejsapi=1`}
                  ref={(el) => {
                    if (el) {
                      videoRefs.current[index] = el;
                    }
                  }}
                  className="aspect-video max-h-[95vh] w-[95vw] rounded-2xl md:w-[80vw]"
                  allowFullScreen
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            );
          },
        }}
      />
    </>
  );
};

export default SearchVideos;
