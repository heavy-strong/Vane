'use client';

import { cn } from '@/lib/utils';
import { BookOpenText, Home, Search, Plus, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegments } from 'next/navigation';
import React, { useEffect, useState, type ReactNode } from 'react';
import Layout from './Layout';
import SidebarPanel from './SidebarPanel';
import SettingsButton from './Settings/SettingsButton';
import { shortcutMatches } from '@/lib/shortcuts';
import { isDesktop } from '@/lib/desktop';
import { usePersistedToggle } from '@/lib/hooks/usePersistedToggle';

const VerticalIconContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col items-center w-full">{children}</div>;
};

const DEFAULT_NEW_QUESTION_SHORTCUT = 'Ctrl+Alt+N';

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const router = useRouter();
  const [expanded, toggleExpanded] = usePersistedToggle(
    'sidebarExpanded',
    true,
  );
  const [newQuestionShortcut, setNewQuestionShortcut] = useState(
    DEFAULT_NEW_QUESTION_SHORTCUT,
  );

  useEffect(() => {
    const loadShortcut = () => {
      const savedShortcut = localStorage.getItem('newQuestionShortcut');

      // Ctrl+Shift+N is reserved by Chromium for a new incognito window.
      // Replace the old default so existing installations get a usable shortcut.
      if (savedShortcut === 'Ctrl+Shift+N') {
        localStorage.setItem(
          'newQuestionShortcut',
          DEFAULT_NEW_QUESTION_SHORTCUT,
        );
        setNewQuestionShortcut(DEFAULT_NEW_QUESTION_SHORTCUT);
        return;
      }

      setNewQuestionShortcut(savedShortcut || DEFAULT_NEW_QUESTION_SHORTCUT);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // In the desktop app the native global shortcut owns this action.
      if (isDesktop()) return;
      if (
        document.activeElement?.getAttribute('data-shortcut-setting') ===
          'new-question' ||
        !shortcutMatches(event, newQuestionShortcut)
      ) {
        return;
      }

      event.preventDefault();
      router.push('/');
    };

    loadShortcut();
    window.addEventListener('client-config-changed', loadShortcut);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('client-config-changed', loadShortcut);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [newQuestionShortcut, router]);

  const navLinks = [
    {
      icon: Home,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Home',
    },
    {
      icon: Search,
      href: '/discover',
      active: segments.includes('discover'),
      label: 'Discover',
    },
    {
      icon: BookOpenText,
      href: '/library',
      active: segments.includes('library') || segments.includes('p'),
      label: 'Library',
    },
  ];

  // In the expanded panel the active chat/project row is highlighted itself,
  // so Home and Library only light up on their own pages.
  const panelNavLinks = navLinks.map((link) => ({
    ...link,
    active:
      link.href === '/'
        ? segments.length === 0
        : link.href === '/library'
          ? segments.includes('library')
          : link.active,
  }));

  return (
    <div>
      {expanded && (
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col border-r border-light-200 dark:border-dark-200">
          <SidebarPanel
            navLinks={panelNavLinks}
            newQuestionShortcut={newQuestionShortcut}
            onCollapse={toggleExpanded}
          />
        </div>
      )}

      <div
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:w-[72px] lg:flex-col border-r border-light-200 dark:border-dark-200',
          !expanded && 'lg:flex',
        )}
      >
        <div className="flex grow flex-col items-center justify-between gap-y-5 overflow-y-auto bg-light-secondary dark:bg-dark-secondary px-2 py-8 shadow-sm shadow-light-200/10 dark:shadow-black/25">
          <div className="flex flex-col items-center gap-y-3">
            <button
              onClick={toggleExpanded}
              className="p-2 rounded-lg text-black/60 dark:text-white/60 hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200"
              aria-label="Expand sidebar"
              title="Show chats and projects"
            >
              <PanelLeftOpen size={19} />
            </button>
            <Link
              className="p-2.5 rounded-full bg-light-200 text-black/70 dark:bg-dark-200 dark:text-white/70 hover:opacity-70 hover:scale-105 tansition duration-200"
              href="/"
            >
              <Plus size={19} className="cursor-pointer" />
            </Link>
          </div>
          <VerticalIconContainer>
            {navLinks.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className={cn(
                  'relative flex flex-col items-center justify-center space-y-0.5 cursor-pointer w-full py-2 rounded-lg',
                  link.active
                    ? 'text-black/70 dark:text-white/70 '
                    : 'text-black/60 dark:text-white/60',
                )}
              >
                <div
                  className={cn(
                    link.active && 'bg-light-200 dark:bg-dark-200',
                    'group rounded-lg hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200',
                  )}
                >
                  <link.icon
                    size={25}
                    className={cn(
                      !link.active && 'group-hover:scale-105',
                      'transition duration:200 m-1.5',
                    )}
                  />
                </div>
                <p
                  className={cn(
                    link.active
                      ? 'text-black/80 dark:text-white/80'
                      : 'text-black/60 dark:text-white/60',
                    'text-[10px]',
                  )}
                >
                  {link.label}
                </p>
              </Link>
            ))}
          </VerticalIconContainer>

          <SettingsButton />
        </div>
      </div>

      <div className="fixed bottom-0 w-full z-50 flex flex-row items-center gap-x-6 bg-light-secondary dark:bg-dark-secondary px-4 py-4 shadow-sm lg:hidden">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'relative flex flex-col items-center space-y-1 text-center w-full',
              link.active
                ? 'text-black dark:text-white'
                : 'text-black dark:text-white/70',
            )}
          >
            {link.active && (
              <div className="absolute top-0 -mt-4 h-1 w-full rounded-b-lg bg-black dark:bg-white" />
            )}
            <link.icon />
            <p className="text-xs">{link.label}</p>
          </Link>
        ))}
      </div>

      <Layout sidebarExpanded={expanded}>{children}</Layout>
    </div>
  );
};

export default Sidebar;
