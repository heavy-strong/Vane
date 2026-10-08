'use client';

import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Folder,
  PanelLeftClose,
  Plus,
  SquarePen,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { useLibrary } from '@/lib/hooks/useLibrary';
import { usePersistedToggle } from '@/lib/hooks/usePersistedToggle';
import { ChatSummary } from '@/lib/library';
import ChatActionsMenu, { InlineRename, renameChat } from './ChatActionsMenu';
import { ProjectDialog } from './ui/Dialogs';
import SettingsButton from './Settings/SettingsButton';

const RECENT_CHAT_LIMIT = 50;

type NavLink = {
  icon: LucideIcon;
  href: string;
  active: boolean;
  label: string;
};

const groupChatsByDate = (chats: ChatSummary[]) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;

  const groups: { label: string; chats: ChatSummary[] }[] = [
    { label: 'Today', chats: [] },
    { label: 'Yesterday', chats: [] },
    { label: 'Previous 7 days', chats: [] },
    { label: 'Previous 30 days', chats: [] },
    { label: 'Older', chats: [] },
  ];

  chats.forEach((chat) => {
    const time = new Date(chat.createdAt).getTime();
    const index =
      time >= startOfToday.getTime()
        ? 0
        : time >= startOfToday.getTime() - day
          ? 1
          : time >= startOfToday.getTime() - 7 * day
            ? 2
            : time >= startOfToday.getTime() - 30 * day
              ? 3
              : 4;
    groups[index].chats.push(chat);
  });

  return groups.filter((group) => group.chats.length > 0);
};

const SectionHeader = ({
  label,
  open,
  onToggle,
  action,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) => (
  <div className="group/section flex items-center justify-between px-2 pt-4 pb-1">
    <button
      onClick={onToggle}
      className="flex items-center gap-1 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors duration-150"
    >
      {label}
      <ChevronRight
        size={13}
        className={cn('transition-transform duration-150', open && 'rotate-90')}
      />
    </button>
    {action}
  </div>
);

const rowClassName = (active: boolean) =>
  cn(
    'group/row relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150',
    active
      ? 'bg-light-200 dark:bg-dark-200 text-black dark:text-white'
      : 'text-black/70 dark:text-white/70 hover:bg-light-200/70 dark:hover:bg-dark-200/70 hover:text-black dark:hover:text-white',
  );

const SidebarPanel = ({
  navLinks,
  newQuestionShortcut,
  onCollapse,
}: {
  navLinks: NavLink[];
  newQuestionShortcut: string;
  onCollapse: () => void;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, projects, loading } = useLibrary(RECENT_CHAT_LIMIT);
  const [projectsOpen, toggleProjects] = usePersistedToggle(
    'sidebarProjectsOpen',
    true,
  );
  const [recentOpen, toggleRecent] = usePersistedToggle(
    'sidebarRecentOpen',
    true,
  );
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const groups = useMemo(() => groupChatsByDate(chats), [chats]);

  return (
    <div className="flex h-full flex-col bg-light-secondary dark:bg-dark-secondary">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <Link
          href="/"
          className="text-xl text-black dark:text-white"
          style={{ fontFamily: 'PP Editorial, serif' }}
        >
          Vane
        </Link>
        <button
          onClick={onCollapse}
          className="rounded-lg p-1.5 text-black/50 dark:text-white/50 hover:bg-light-200 dark:hover:bg-dark-200 hover:text-black dark:hover:text-white transition-colors duration-150"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="px-3">
        {/* Opening / starts a new chat; a full reload would also blank the
            page and cut off an answer still streaming in. */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 text-sm text-black/80 dark:text-white/80 hover:border-[#24A0ED]/60 transition-colors duration-150"
        >
          <SquarePen size={16} />
          <span className="flex-1">New chat</span>
          {newQuestionShortcut && (
            <kbd className="text-[10px] font-sans text-black/40 dark:text-white/40">
              {newQuestionShortcut}
            </kbd>
          )}
        </Link>

        <nav className="mt-3 flex flex-col gap-0.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={rowClassName(link.active)}
            >
              <link.icon size={17} />
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-3 pb-4">
        <SectionHeader
          label="Projects"
          open={projectsOpen}
          onToggle={toggleProjects}
          action={
            <button
              onClick={() => setProjectDialogOpen(true)}
              className="rounded-md p-0.5 text-black/50 dark:text-white/50 hover:bg-light-200 dark:hover:bg-dark-200 hover:text-black dark:hover:text-white transition-colors duration-150"
              aria-label="New project"
              title="New project"
            >
              <Plus size={15} />
            </button>
          }
        />
        {projectsOpen && (
          <div className="flex flex-col gap-0.5">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/p/${project.id}`}
                className={rowClassName(pathname === `/p/${project.id}`)}
              >
                <Folder size={16} className="shrink-0" />
                <span className="flex-1 truncate">{project.name}</span>
                <span className="text-[11px] text-black/40 dark:text-white/40">
                  {project.chatCount}
                </span>
              </Link>
            ))}
            {!loading && projects.length === 0 && (
              <button
                onClick={() => setProjectDialogOpen(true)}
                className="px-2 py-1.5 text-left text-xs text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors duration-150"
              >
                Create a project to organize chats
              </button>
            )}
          </div>
        )}

        <SectionHeader
          label="Recent"
          open={recentOpen}
          onToggle={toggleRecent}
        />
        {recentOpen && (
          <div className="flex flex-col">
            {!loading && chats.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-black/40 dark:text-white/40">
                Your chats will appear here.
              </p>
            )}
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <p className="px-2 pt-2 pb-0.5 text-[11px] text-black/40 dark:text-white/40">
                  {group.label}
                </p>
                {group.chats.map((chat) =>
                  renamingId === chat.id ? (
                    <InlineRename
                      key={chat.id}
                      initialValue={chat.title}
                      onSubmit={(title) => {
                        setRenamingId(null);
                        renameChat(chat.id, title);
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <div
                      key={chat.id}
                      className={rowClassName(pathname === `/c/${chat.id}`)}
                    >
                      <Link
                        href={`/c/${chat.id}`}
                        className="flex-1 truncate"
                        title={chat.title}
                      >
                        {chat.title}
                      </Link>
                      <ChatActionsMenu
                        chat={chat}
                        projects={projects}
                        onRename={() => setRenamingId(chat.id)}
                        className="opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                      />
                    </div>
                  ),
                )}
              </div>
            ))}
            {chats.length >= RECENT_CHAT_LIMIT && (
              <Link
                href="/library"
                className="px-2 pt-2 text-xs text-black/50 dark:text-white/50 hover:text-[#24A0ED] transition-colors duration-150"
              >
                View all chats
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center border-t border-light-200 dark:border-dark-200 px-3 py-3">
        <SettingsButton />
      </div>

      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        onSaved={(project) => router.push(`/p/${project.id}`)}
      />
    </div>
  );
};

export default SidebarPanel;
