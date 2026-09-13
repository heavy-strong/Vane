import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { searchSearxng } from '@/lib/searxng';
import { resolveSearchOptions } from '@/lib/searchEngines';
import {
  videoSearchFewShots,
  videoSearchPrompt,
} from '@/lib/prompts/media/videos';
import { ChatTurnMessage } from '@/lib/types';
import BaseLLM from '@/lib/models/base/llm';
import z from 'zod';

type VideoSearchChainInput = {
  chatHistory: ChatTurnMessage[];
  query: string;
};

type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  /* Absent for engines without an embeddable player (e.g. Naver); the UI
   * links out to `url` instead. */
  iframe_src?: string;
};

const searchVideos = async (
  input: VideoSearchChainInput,
  llm: BaseLLM<any>,
) => {
  const schema = z.object({
    query: z.string().describe('The video search query.'),
  });

  const res = await llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: videoSearchPrompt,
      },
      ...videoSearchFewShots,
      {
        role: 'user',
        content: `<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`,
      },
    ],
    schema: schema,
  });

  const searchRes = await searchSearxng(
    res.query,
    await resolveSearchOptions(res.query, 'videos', input.query),
  );

  const videos: VideoSearchResult[] = [];

  searchRes.results.forEach((result) => {
    const thumbnail = result.thumbnail || result.thumbnail_src;
    if (thumbnail && result.url && result.title) {
      videos.push({
        img_src: thumbnail,
        url: result.url,
        title: result.title,
        iframe_src: result.iframe_src,
      });
    }
  });

  /* Embeddable videos first so the inline player is preferred */
  videos.sort((a, b) => Number(!!b.iframe_src) - Number(!!a.iframe_src));

  return videos.slice(0, 10);
};

export default searchVideos;
