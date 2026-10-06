'use client';

import ChatActionsMenu, {
  InlineRename,
  renameChat,
} from '@/components/ChatActionsMenu';
import { ConfirmDialog, ProjectDialog } from '@/components/ui/Dialogs';
import Loader from '@/components/ui/Loader';
import {
  ChatSummary,
  deleteProject,
  fetchProject,
  fetchProjects,
  LIBRARY_CHANGED_EVENT,
  Project,
} from '@/lib/library';
import { formatTimeDifference } from '@/lib/utils';
import {
  ArrowUp,
  ClockIcon,
  FileText,
  Folder,
  MessageSquare,
  Pencil,
  ScrollText,
  Trash,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

const ProjectPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteChats, setDeleteChats] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, allProjects] = await Promise.all([
        fetchProject(projectId),
        fetchProjects(),
      ]);
      setProject(data.project);
      setChats(data.chats);
      setProjects(allProjects);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load();
    window.addEventListener(LIBRARY_CHANGED_EVENT, load);
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, load);
  }, [load]);

  useEffect(() => {
    if (project) document.title = `${project.name} - Vane`;
  }, [project]);

  const startChat = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(
      `/?project=${encodeURIComponent(projectId)}&q=${encodeURIComponent(trimmed)}`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <Folder className="text-black/50 dark:text-white/50" />
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          This project doesn&apos;t exist anymore.
        </p>
        <Link href="/library" className="mt-1 text-sm text-sky-400">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="flex flex-col pt-10 pb-6 px-2 border-b border-light-200/20 dark:border-dark-200/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
              <Folder size={22} className="text-[#24A0ED]" />
            </div>
            <div className="min-w-0">
              <h1
                className="text-4xl font-normal text-black dark:text-white break-words"
                style={{ fontFamily: 'PP Editorial, serif' }}
              >
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-lg p-2 text-black/60 dark:text-white/60 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
              aria-label="Edit project"
              title="Edit project"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={() => {
                setDeleteChats(false);
                setDeleteOpen(true);
              }}
              className="rounded-lg p-2 text-red-400 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
              aria-label="Delete project"
              title="Delete project"
            >
              <Trash size={17} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 pt-6 flex flex-col gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startChat();
          }}
          className="flex items-end gap-2 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary px-4 py-3 focus-within:border-[#24A0ED]/60 transition-colors duration-200"
        >
          <TextareaAutosize
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                startChat();
              }
            }}
            minRows={1}
            maxRows={8}
            placeholder={`Ask anything in ${project.name}…`}
            className="flex-1 resize-none bg-transparent text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none py-1.5"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="rounded-full bg-[#24A0ED] p-2 text-white disabled:bg-black/20 dark:disabled:bg-white/20 transition duration-200"
            aria-label="Start chat"
          >
            <ArrowUp size={17} />
          </button>
        </form>

        {project.instructions && (
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-start gap-3 rounded-2xl border border-light-200 dark:border-dark-200 p-4 text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
          >
            <ScrollText
              size={17}
              className="mt-0.5 shrink-0 text-black/60 dark:text-white/60"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-black/50 dark:text-white/50">
                Instructions
              </p>
              <p className="mt-1 text-sm text-black/80 dark:text-white/80 whitespace-pre-wrap line-clamp-4">
                {project.instructions}
              </p>
            </div>
          </button>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-black/50 dark:text-white/50">
            {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </p>
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-light-200 dark:border-dark-200 py-12 text-center">
              <MessageSquare className="text-black/40 dark:text-white/40" />
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                No chats yet. Ask a question above, or move existing chats here
                from the sidebar.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-light-200 dark:border-dark-200 overflow-hidden">
              {chats.map((chat, index) => (
                <div
                  key={chat.id}
                  className={
                    'group flex items-start justify-between gap-3 p-4 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200 ' +
                    (index !== chats.length - 1
                      ? 'border-b border-light-200 dark:border-dark-200'
                      : '')
                  }
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === chat.id ? (
                      <InlineRename
                        initialValue={chat.title}
                        onSubmit={(title) => {
                          setRenamingId(null);
                          renameChat(chat.id, title);
                        }}
                        onCancel={() => setRenamingId(null)}
                        className="text-base"
                      />
                    ) : (
                      <Link
                        href={`/c/${chat.id}`}
                        className="block text-black dark:text-white text-base font-medium leading-snug line-clamp-2 group-hover:text-[#24A0ED] transition duration-200"
                        title={chat.title}
                      >
                        {chat.title}
                      </Link>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-black/70 dark:text-white/70">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <ClockIcon size={14} />
                        {formatTimeDifference(new Date(), chat.createdAt)} Ago
                      </span>
                      {chat.files.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs border border-black/20 dark:border-white/20 rounded-full px-2 py-0.5">
                          <FileText size={14} />
                          {chat.files.length}{' '}
                          {chat.files.length === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChatActionsMenu
                    chat={chat}
                    projects={projects}
                    onRename={() => setRenamingId(chat.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProjectDialog
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onSaved={setProject}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete project"
        description={
          <>
            Delete <span className="font-medium">“{project.name}”</span>?{' '}
            {deleteChats
              ? 'Its chats will be deleted too.'
              : 'Its chats will be kept in your library.'}
          </>
        }
        onConfirm={async () => {
          await deleteProject(project.id, deleteChats);
          router.push('/library');
        }}
        onClose={() => setDeleteOpen(false)}
      >
        {chats.length > 0 && (
          <label className="mt-4 flex items-center gap-2 text-sm text-black/70 dark:text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteChats}
              onChange={(e) => setDeleteChats(e.target.checked)}
              className="accent-red-500"
            />
            Also delete {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default ProjectPage;
