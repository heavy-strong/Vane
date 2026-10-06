'use client';

import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  createProject,
  updateProject,
  type Project,
  type ProjectInput,
} from '@/lib/library';

const panelClassName =
  'w-full transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all';

const DialogShell = ({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) => (
  <Dialog open={open} as="div" className="relative z-[60]" onClose={onClose}>
    <DialogBackdrop
      transition
      className="fixed inset-0 bg-black/30 transition duration-150 data-[closed]:opacity-0"
    />
    <div className="fixed inset-0 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <DialogPanel
          transition
          className={cn(
            panelClassName,
            'duration-150 ease-out data-[closed]:opacity-0 data-[closed]:scale-95',
            className,
          )}
        >
          {children}
        </DialogPanel>
      </div>
    </div>
  </Dialog>
);

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onClose={() => !loading && onClose()}
      className="max-w-md"
    >
      <DialogTitle className="text-lg font-medium leading-6 text-black dark:text-white">
        {title}
      </DialogTitle>
      <Description className="mt-1 text-sm text-black/70 dark:text-white/70">
        {description}
      </Description>
      {children}
      <div className="flex flex-row items-end justify-end space-x-4 mt-6">
        <button
          onClick={() => !loading && onClose()}
          className="text-black/50 dark:text-white/50 text-sm hover:text-black/70 hover:dark:text-white/70 transition duration-200"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="text-red-400 text-sm hover:text-red-500 transition duration-200 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
};

const fieldClassName =
  'w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-[#24A0ED] transition-colors duration-200';

export const ProjectDialog = ({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** When provided the dialog edits this project, otherwise it creates one. */
  project?: Project | null;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}) => {
  const [form, setForm] = useState<ProjectInput>({
    name: '',
    description: '',
    instructions: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: project?.name ?? '',
        description: project?.description ?? '',
        instructions: project?.instructions ?? '',
      });
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || loading) return;

    setLoading(true);
    try {
      const saved = project
        ? { ...project, ...(await updateProject(project.id, form)) }
        : await createProject(form);
      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onClose={() => !loading && onClose()}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <DialogTitle className="text-lg font-medium leading-6 text-black dark:text-white">
            {project ? 'Edit project' : 'New project'}
          </DialogTitle>
          <Description className="mt-1 text-sm text-black/60 dark:text-white/60">
            Group related chats together and give them shared instructions.
          </Description>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            Name
          </span>
          <input
            autoFocus
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Trip to Japan"
            className={fieldClassName}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            Description{' '}
            <span className="text-black/40 dark:text-white/40">(optional)</span>
          </span>
          <input
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this project about?"
            className={fieldClassName}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            Instructions{' '}
            <span className="text-black/40 dark:text-white/40">(optional)</span>
          </span>
          <textarea
            rows={4}
            maxLength={4000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="Applied to every chat in this project, e.g. “Answer in Korean and prefer official sources.”"
            className={cn(fieldClassName, 'resize-none')}
          />
        </label>

        <div className="flex flex-row items-center justify-end space-x-4 mt-2">
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className="text-black/50 dark:text-white/50 text-sm hover:text-black/70 hover:dark:text-white/70 transition duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || loading}
            className="rounded-lg bg-[#24A0ED] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d8fd6] transition duration-200 disabled:opacity-50"
          >
            {project ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
};
