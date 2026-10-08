import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { getSuggestionGeneratorPrompt } from '@/lib/prompts/suggestions';
import { ChatTurnMessage } from '@/lib/types';
import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';

type SuggestionGeneratorInput = {
  chatHistory: ChatTurnMessage[];
};

const schema = z.object({
  suggestions: z
    .array(z.string())
    .describe('List of suggested questions or prompts'),
});

const generateSuggestions = async (
  input: SuggestionGeneratorInput,
  llm: BaseLLM<any>,
) => {
  const res = await llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: getSuggestionGeneratorPrompt(),
      },
      {
        role: 'user',
        content: `<chat_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</chat_history>`,
      },
    ],
    schema,
  });

  return res.suggestions
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
};

export default generateSuggestions;
