'use client';

import { useEffect } from 'react';
import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import NextError from 'next/error';
import { useChat } from '@/lib/hooks/useChat';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Block } from '@/lib/types';
import Loader from './ui/Loader';
import {
  decodeUrlsInText,
  isDecodeCitationUrlsEnabled,
} from '@/lib/utils/urlDecode';

export interface BaseMessage {
  chatId: string;
  messageId: string;
  createdAt: Date;
}

export interface Message extends BaseMessage {
  backendId: string;
  query: string;
  responseBlocks: Block[];
  status: 'answering' | 'completed' | 'error';
  modelName?: string | null;
  modelProvider?: string | null;
  durationMs?: number | null;
}

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export interface Widget {
  widgetType: string;
  params: Record<string, any>;
}

// When a user selects rendered content (e.g. a citation link) and copies it
// natively (drag-select + Ctrl+C), the clipboard would otherwise contain the
// raw percent-encoded URL. Intercept the copy event and decode any URLs in
// the selection, unless the user has turned this preference off.
const useDecodeCopiedUrls = () => {
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (!isDecodeCitationUrlsEnabled()) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0)
        return;

      const text = selection.toString();
      if (!text) return;

      // Copying selected text also puts an HTML fragment on the clipboard.
      // Rich-text targets (docs/notes apps, browser address bars, etc.) use
      // the <a href> from that fragment rather than the plain text - e.g.
      // dragging over a citation number like "[1]" - so the underlying href
      // must be decoded too, not just the visible text.
      const fragment = selection.getRangeAt(0).cloneContents();
      const anchors = fragment.querySelectorAll('a[href]');
      let hrefChanged = false;
      anchors.forEach((a) => {
        const href = a.getAttribute('href');
        if (!href) return;
        try {
          const decodedHref = decodeURI(href);
          if (decodedHref !== href) {
            a.setAttribute('href', decodedHref);
            hrefChanged = true;
          }
        } catch {
          // leave malformed URIs untouched
        }
      });

      const decodedText = decodeUrlsInText(text);

      if (!hrefChanged && decodedText === text) return;
      if (!e.clipboardData) return;

      const container = document.createElement('div');
      container.appendChild(fragment);

      e.clipboardData.setData('text/plain', decodedText);
      e.clipboardData.setData('text/html', container.innerHTML);
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);
};

const ChatWindow = () => {
  const { hasError, notFound, messages, isReady } = useChat();

  useDecodeCopiedUrls();

  if (hasError) {
    return (
      <div className="relative">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5">
          <SettingsButtonMobile />
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="dark:text-white/70 text-black/70 text-sm">
            Failed to connect to the server. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return isReady ? (
    notFound ? (
      <NextError statusCode={404} />
    ) : (
      <div>
        {messages.length > 0 ? (
          <>
            <Navbar />
            <Chat />
          </>
        ) : (
          <EmptyChat />
        )}
      </div>
    )
  ) : (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Loader />
    </div>
  );
};

export default ChatWindow;
