'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChatSummary,
  fetchChats,
  fetchProjects,
  LIBRARY_CHANGED_EVENT,
  Project,
} from '../library';

/** Recent chats and projects, kept in sync with library change events. */
export const useLibrary = (chatLimit?: number) => {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextChats, nextProjects] = await Promise.all([
        fetchChats(chatLimit),
        fetchProjects(),
      ]);
      setChats(nextChats);
      setProjects(nextProjects);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }, [chatLimit]);

  useEffect(() => {
    refresh();
    window.addEventListener(LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, refresh);
  }, [refresh]);

  return { chats, projects, loading, refresh };
};
