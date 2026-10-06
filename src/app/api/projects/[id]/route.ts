import db from '@/lib/db';
import { chats, messages, projects } from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(100)
    .optional(),
  description: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(4000).optional(),
});

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    const projectChats = await db
      .select()
      .from(chats)
      .where(eq(chats.projectId, id))
      .orderBy(desc(chats.createdAt));

    return Response.json(
      {
        project: { ...project, chatCount: projectChats.length },
        chats: projectChats,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting project by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());

    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    await db
      .update(projects)
      .set(parsed.data)
      .where(eq(projects.id, id))
      .execute();

    return Response.json(
      { project: { ...project, ...parsed.data } },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in updating project: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

/**
 * Deletes a project. By default its chats are kept and moved back to the
 * general history; pass `?deleteChats=true` to delete them as well.
 */
export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const deleteChats =
      new URL(req.url).searchParams.get('deleteChats') === 'true';

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    if (deleteChats) {
      const chatIds = (
        await db
          .select({ id: chats.id })
          .from(chats)
          .where(eq(chats.projectId, id))
      ).map((chat) => chat.id);

      if (chatIds.length > 0) {
        await db
          .delete(messages)
          .where(inArray(messages.chatId, chatIds))
          .execute();
        await db.delete(chats).where(inArray(chats.id, chatIds)).execute();
      }
    } else {
      await db
        .update(chats)
        .set({ projectId: null })
        .where(eq(chats.projectId, id))
        .execute();
    }

    await db.delete(projects).where(eq(projects.id, id)).execute();

    return Response.json(
      { message: 'Project deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting project: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
