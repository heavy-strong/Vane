'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestFollowUp } from '../followUpRequest';

export type MediaStatus = 'idle' | 'loading' | 'done' | 'error';

/**
 * Fetches the images or videos for a message on demand. `load` is a no-op
 * once results are in or a request is in flight, so tabs and the auto media
 * search can both call it freely.
 */
export const useMediaSearch = <T>(
  kind: 'images' | 'videos',
  query: string,
  chatHistory: [string, string][],
) => {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<MediaStatus>('idle');
  const statusRef = useRef<MediaStatus>('idle');

  const update = (next: MediaStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const historyRef = useRef(chatHistory);
  useEffect(() => {
    historyRef.current = chatHistory;
  }, [chatHistory]);

  const load = useCallback(async () => {
    if (statusRef.current === 'loading' || statusRef.current === 'done') return;
    update('loading');

    try {
      const data = await requestFollowUp<Partial<Record<typeof kind, T[]>>>(
        `/api/${kind}`,
        {
          query,
          chatHistory: historyRef.current,
          chatModel: {
            providerId: localStorage.getItem('chatModelProviderId'),
            key: localStorage.getItem('chatModelKey'),
          },
        },
      );
      setItems(data[kind] ?? []);
      update('done');
    } catch (error) {
      console.error(`Could not search ${kind}`, error);
      update('error');
    }
  }, [kind, query]);

  return { items, status, load };
};
