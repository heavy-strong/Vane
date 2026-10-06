import db from '@/lib/db';
import { chats, projects } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100),
  description: z.string().trim().max(500).optional().default(''),
  instructions: z.string().trim().max(4000).optional().default(''),
});

export const GET = async () => {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    const allChats = await db
      .select({ projectId: chats.projectId })
      .from(chats);

    const counts = new Map<string, number>();
    allChats.forEach((chat) => {
      if (chat.projectId) {
        counts.set(chat.projectId, (counts.get(chat.projectId) ?? 0) + 1);
      }
    });

    return Response.json(
      {
        projects: allProjects.map((project) => ({
          ...project,
          chatCount: counts.get(project.id) ?? 0,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting projects: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    const parsed = createSchema.safeParse(await req.json());

    if (!parsed.success) {
      return Response.json(
        { message: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const project = {
      id: crypto.randomBytes(10).toString('hex'),
      createdAt: new Date().toISOString(),
      ...parsed.data,
    };

    await db.insert(projects).values(project).execute();

    return Response.json(
      { project: { ...project, chatCount: 0 } },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in creating project: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
