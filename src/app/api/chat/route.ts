import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider, ReasoningEffort } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats, projects } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const reasoningSchema = z.object({
  enabled: z.boolean().optional(),
  effort: z
    .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    .optional(),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  reasoning: reasoningSchema.optional(),
  systemInstructions: z.string().nullable().optional().default(''),
  projectId: z.string().nullable().optional(),
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
  projectId?: string | null;
}): Promise<string | null> => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (exists) {
      return exists.projectId ?? null;
    }

    let projectId: string | null = null;
    if (input.projectId) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });
      projectId = project ? project.id : null;
    }

    await db.insert(chats).values({
      id: input.id,
      createdAt: new Date().toISOString(),
      sources: input.sources,
      title: input.query,
      files: input.fileIds.map((id) => {
        return {
          fileId: id,
          name: UploadManager.getFile(id)?.name || 'Uploaded File',
        };
      }),
      projectId,
    });

    return projectId;
  } catch (err) {
    console.error('Failed to check/save chat:', err);
    return null;
  }
};

const getProjectInstructions = async (projectId: string | null) => {
  if (!projectId) return '';

  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    return project?.instructions?.trim() ?? '';
  } catch (err) {
    console.error('Failed to load project instructions:', err);
    return '';
  }
};

export const POST = async (req: Request) => {
  try {
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);

    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();

    const [llm, embedding, modelInfo] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key, {
        reasoning: body.reasoning as
          | { enabled?: boolean; effort?: ReasoningEffort }
          | undefined,
      }),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
      registry.getChatModelDisplayInfo(
        body.chatModel.providerId,
        body.chatModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return {
          role: 'user',
          content: msg[1],
        };
      } else {
        return {
          role: 'assistant',
          content: msg[1],
        };
      }
    });

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    session.emit('data', {
      type: 'modelInfo',
      modelName: modelInfo.modelName,
      modelProvider: modelInfo.providerName,
    });

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Lets the client address this session, e.g. to stop it.
    writer.write(
      encoder.encode(
        JSON.stringify({ type: 'session', sessionId: session.id }) + '\n',
      ),
    );

    const disconnect = session.subscribe((event: string, data: any) => {
      if (event === 'data') {
        if (data.type === 'block') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'block',
                block: data.block,
              }) + '\n',
            ),
          );
        } else if (data.type === 'updateBlock') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'updateBlock',
                blockId: data.blockId,
                patch: data.patch,
              }) + '\n',
            ),
          );
        } else if (data.type === 'appendText') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'appendText',
                blockId: data.blockId,
                delta: data.delta,
              }) + '\n',
            ),
          );
        } else if (data.type === 'researchComplete') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'researchComplete',
              }) + '\n',
            ),
          );
        } else if (data.type === 'modelInfo') {
          writer.write(
            encoder.encode(
              JSON.stringify({
                type: 'modelInfo',
                modelName: data.modelName,
                modelProvider: data.modelProvider,
              }) + '\n',
            ),
          );
        }
      } else if (event === 'end') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'messageEnd',
              durationMs: data?.durationMs,
              stopped: data?.stopped === true,
            }) + '\n',
          ),
        );
        writer.close();
        session.removeAllListeners();
      } else if (event === 'error') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'error',
              data: data.data,
            }) + '\n',
          ),
        );
        writer.close();
        session.removeAllListeners();
      }
    });

    // Saved before streaming starts so the chat (and its project) is visible
    // in the sidebar as soon as the client receives the response.
    const projectId = await ensureChatExists({
      id: body.message.chatId,
      sources: body.sources as SearchSources[],
      fileIds: body.files,
      query: body.message.content,
      projectId: body.projectId,
    });

    const projectInstructions = await getProjectInstructions(projectId);
    const systemInstructions =
      [body.systemInstructions?.trim(), projectInstructions]
        .filter(Boolean)
        .join('\n\n') || 'None';

    agent
      .searchAsync(session, {
        chatHistory: history,
        followUp: message.content,
        chatId: body.message.chatId,
        messageId: body.message.messageId,
        config: {
          llm,
          embedding: embedding,
          sources: body.sources as SearchSources[],
          mode: body.optimizationMode,
          fileIds: body.files,
          systemInstructions,
          modelInfo: {
            providerName: modelInfo.providerName,
            modelName: modelInfo.modelName,
          },
        },
      })
      .catch((err) => {
        console.error('An error occurred in search agent:', err);
        session.emit('error', {
          data: err instanceof Error ? err.message : 'An error occurred',
        });
      });

    req.signal.addEventListener('abort', () => {
      disconnect();
      writer.close();
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
