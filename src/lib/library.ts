'use client';

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  sources: string[];
  files: { fileId: string; name: string }[];
  projectId?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  chatCount: number;
}

export type ProjectInput = Pick<
  Project,
  'name' | 'description' | 'instructions'
>;

/**
 * Fired whenever chats or projects are created, renamed, moved or deleted so
 * every view showing them (sidebar, library, project page) can refresh.
 */
export const LIBRARY_CHANGED_EVENT = 'library-changed';

export const notifyLibraryChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
  }
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data as T;
};

export const fetchChats = async (limit?: number) => {
  const data = await request<{ chats: ChatSummary[] }>(
    `/api/chats${limit ? `?limit=${limit}` : ''}`,
  );
  return data.chats;
};

export const fetchProjects = async () => {
  const data = await request<{ projects: Project[] }>('/api/projects');
  return data.projects;
};

export const fetchProject = async (id: string) => {
  return request<{ project: Project; chats: ChatSummary[] }>(
    `/api/projects/${id}`,
  );
};

export const createProject = async (input: ProjectInput) => {
  const data = await request<{ project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  notifyLibraryChanged();
  return data.project;
};

export const updateProject = async (
  id: string,
  input: Partial<ProjectInput>,
) => {
  const data = await request<{ project: Project }>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  notifyLibraryChanged();
  return data.project;
};

export const deleteProject = async (id: string, deleteChats = false) => {
  await request(`/api/projects/${id}?deleteChats=${deleteChats}`, {
    method: 'DELETE',
  });
  notifyLibraryChanged();
};

export const updateChat = async (
  id: string,
  input: { title?: string; projectId?: string | null },
) => {
  await request(`/api/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  notifyLibraryChanged();
};

export const deleteChat = async (id: string) => {
  await request(`/api/chats/${id}`, { method: 'DELETE' });
  notifyLibraryChanged();
};
