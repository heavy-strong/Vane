import crypto from 'crypto';
import generateSuggestions from '@/lib/agents/suggestions';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import { Block } from '@/lib/types';
import { and, eq } from 'drizzle-orm';

interface SuggestionsGenerationBody {
  chatHistory: any[];
  chatModel: ModelWithProvider;
  chatId?: string;
  messageId?: string;
}

/* Stores the suggestions on the answered message so they survive a reload. */
const saveSuggestions = async (
  chatId: string,
  messageId: string,
  suggestions: string[],
) => {
  const where = and(
    eq(messages.chatId, chatId),
    eq(messages.messageId, messageId),
  );

  const message = await db.query.messages.findFirst({ where });

  if (!message) return;

  const blocks: Block[] = message.responseBlocks ?? [];

  await db
    .update(messages)
    .set({
      responseBlocks: [
        ...blocks.filter((b) => b.type !== 'suggestion'),
        {
          id: crypto.randomBytes(7).toString('hex'),
          type: 'suggestion',
          data: suggestions,
        },
      ],
    })
    .where(where)
    .execute();
};

export const POST = async (req: Request) => {
  try {
    const body: SuggestionsGenerationBody = await req.json();

    const registry = new ModelRegistry();

    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const suggestions = await generateSuggestions(
      {
        chatHistory: body.chatHistory.map(([role, content]) => ({
          role: role === 'human' ? 'user' : 'assistant',
          content,
        })),
      },
      llm,
    );

    if (body.chatId && body.messageId && suggestions.length > 0) {
      try {
        await saveSuggestions(body.chatId, body.messageId, suggestions);
      } catch (err) {
        console.error(`An error occurred while saving suggestions: ${err}`);
      }
    }

    return Response.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error(`An error occurred while generating suggestions: ${err}`);
    return Response.json(
      { message: 'An error occurred while generating suggestions' },
      { status: 500 },
    );
  }
};
