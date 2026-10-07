'use client';

import { getNotifyOnSearchComplete } from './config/clientRegistry';
import { isDesktop } from './desktop';

const MAX_LENGTH = 160;

const isInBackground = () =>
  document.visibilityState === 'hidden' || !document.hasFocus();

const toPlainText = (markdown: string) =>
  markdown
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~|$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (text: string) =>
  text.length > MAX_LENGTH
    ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…`
    : text;

/**
 * Asks the browser for notification permission; call it from a user gesture. The desktop app
 * shows native notifications, so it needs no browser permission.
 */
export const requestNotificationPermission = async () => {
  if (isDesktop() || typeof Notification === 'undefined') return true;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
};

/**
 * Asks once, while notifications are enabled but the browser has not been asked yet. Called when a
 * question is sent, which is a user gesture, so browsers allow the prompt.
 */
export const promptForNotificationPermission = () => {
  if (
    isDesktop() ||
    typeof Notification === 'undefined' ||
    Notification.permission !== 'default' ||
    !getNotifyOnSearchComplete()
  ) {
    return;
  }
  Notification.requestPermission().catch(() => {});
};

/** Tells the user an answer is ready, but only while Vane is not the window they are looking at. */
export const notifySearchComplete = (query: string, answer: string) => {
  if (typeof window === 'undefined') return;
  if (!getNotifyOnSearchComplete() || !isInBackground()) return;

  const title = truncate(query.trim()) || 'Vane';
  const body = truncate(toPlainText(answer)) || 'Your answer is ready.';

  if (isDesktop()) {
    window.__TAURI__?.core
      .invoke('show_notification', { title, body })
      .catch((error) => console.error('Could not show notification', error));
    return;
  }

  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon.png',
      tag: 'vane-search-complete',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    // Some mobile browsers only allow notifications from a service worker.
    console.error('Could not show notification', error);
  }
};
