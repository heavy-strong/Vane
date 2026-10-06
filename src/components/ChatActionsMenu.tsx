'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  Check,
  Folder,
  FolderMinus,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChatSummary, deleteChat, Project, updateChat } from '@/lib/library';
import { ConfirmDialog, ProjectDialog } from './ui/Dialogs';

const itemClassName =
  'group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-black/80 dark:text-white/80 data-[focus]:bg-light-200 dark:data-[focus]:bg-dark-200';

const ChatActionsMenu = ({
  chat,
  projects,
  onRename,
  className,
}: {
  chat: ChatSummary;
  projects: Project[];
  onRename: () => void;
  className?: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const moveTo = async (projectId: string | null) => {
    try {
      await updateChat(chat.id, { projectId });
      const project = projects.find((p) => p.id === projectId);
      toast.success(
        project ? `Moved to ${project.name}` : 'Removed from project',
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move chat');
    }
  };

  const handleDelete = async () => {
    await deleteChat(chat.id);
    if (pathname === `/c/${chat.id}`) {
      router.push('/');
    }
  };

  return (
    <>
      <Menu>
        <MenuButton
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'rounded-md p-1 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-light-200 dark:hover:bg-dark-200 data-[open]:opacity-100 transition duration-150',
            className,
          )}
          aria-label="Chat actions"
        >
          <MoreHorizontal size={16} />
        </MenuButton>
        <MenuItems
          anchor="bottom end"
          transition
          className="z-[55] w-56 max-h-[60vh] overflow-y-auto rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-1 shadow-xl shadow-black/10 dark:shadow-black/30 [--anchor-gap:4px] focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <MenuItem>
            <button className={itemClassName} onClick={onRename}>
              <Pencil size={15} />
              Rename
            </button>
          </MenuItem>

          <div className="my-1 h-px bg-light-200 dark:bg-dark-200" />
          <p className="px-2.5 pt-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
            Move to project
          </p>
          {projects.map((project) => (
            <MenuItem key={project.id}>
              <button
                className={itemClassName}
                onClick={() =>
                  project.id !== chat.projectId && moveTo(project.id)
                }
              >
                <Folder size={15} className="shrink-0" />
                <span className="flex-1 truncate">{project.name}</span>
                {project.id === chat.projectId && (
                  <Check size={14} className="text-[#24A0ED]" />
                )}
              </button>
            </MenuItem>
          ))}
          <MenuItem>
            <button
              className={itemClassName}
              onClick={() => setProjectDialogOpen(true)}
            >
              <FolderPlus size={15} />
              New project…
            </button>
          </MenuItem>
          {chat.projectId && (
            <MenuItem>
              <button className={itemClassName} onClick={() => moveTo(null)}>
                <FolderMinus size={15} />
                Remove from project
              </button>
            </MenuItem>
          )}

          <div className="my-1 h-px bg-light-200 dark:bg-dark-200" />
          <MenuItem>
            <button
              className={cn(itemClassName, 'text-red-500 dark:text-red-400')}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash size={15} />
              Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete chat"
        description={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium">“{chat.title}”</span>?
          </>
        }
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        onSaved={(project) => moveTo(project.id)}
      />
    </>
  );
};

export const InlineRename = ({
  initialValue,
  onSubmit,
  onCancel,
  className,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    // Deferred so the menu that triggered the rename restores its own focus
    // first instead of immediately blurring (and submitting) this input.
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const trimmed = value.trim();
    if (save && trimmed && trimmed !== initialValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={300}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      className={cn(
        'w-full rounded-md border border-[#24A0ED] bg-light-primary dark:bg-dark-primary px-2 py-1 text-sm text-black dark:text-white focus:outline-none',
        className,
      )}
    />
  );
};

export const renameChat = async (chatId: string, title: string) => {
  try {
    await updateChat(chatId, { title });
  } catch (err: any) {
    toast.error(err?.message || 'Failed to rename chat');
  }
};

export default ChatActionsMenu;
