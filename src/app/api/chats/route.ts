import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const limitParam = Number(new URL(req.url).searchParams.get('limit'));
    const query = db.select().from(chats).orderBy(desc(chats.createdAt));
    const result =
      Number.isInteger(limitParam) && limitParam > 0
        ? await query.limit(limitParam)
        : await query;

    return Response.json({ chats: result }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
