import z from 'zod';
import { ResearchAction } from '../../../types';
import { ResearchBlock } from '@/lib/types';
import { executeSearch } from './baseSearch';

const actionSchema = z.object({
  type: z.literal('web_search'),
  queries: z
    .array(z.string())
    .describe(
      "Up to 3 targeted queries. Keep one unquoted query using the user's terms. For unfamiliar product/feature names, try spelling/spacing variants and a query for official documentation, without guessing a different intent.",
    ),
});

const queryGuidance = `
For a product or feature definition, first establish its identity from primary sources:
- Include an unquoted keyword query preserving the user's terms; do not put an unfamiliar multiword name in exact-match quotes in every query. Exact phrases can hide official spellings with different spacing or hyphenation.
- Use the other queries for plausible spelling/spacing variants and official documentation or release notes. Use site: only for a known or discovered official domain; do not invent domains or URLs.
- Search in the product's original language (often English), even if the question is Korean. Keep a local-language query when it adds useful context.
- Do not reinterpret an unfamiliar term as a pricing plan, competing product, or unrelated feature without evidence. Establish what it is before searching comparisons.
- Prefer relevant first-party documentation over social posts, videos, and SEO summaries. If snippets don't define the term, read a promising official URL with scrape_url. If only weak sources appear, refine the spelling or search the official domain before concluding the evidence is insufficient.
`;

const speedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.
You are currently on speed mode. Gather the best evidence in one search batch, then use at most one follow-up search or page-reading call if needed to establish the answer.

Your queries should be very targeted and specific to the information you need, avoid broad or generic queries.
Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example, if the user is asking about the features of a new technology, you might use queries like "GPT-5.1 features", "GPT-5.1 release date", "GPT-5.1 improvements" rather than a broad query like "Tell me about GPT-5.1".

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information.
`;

const balancedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You can call this tool several times if needed to gather enough information.
Start with targeted queries about the user's actual subject, then refine based on the evidence returned.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example if the user is asking about Tesla, your actions should be like:
1. __reasoning_preamble "The user is asking about Tesla. I will start with broader queries to get an overview of Tesla, then narrow down with more specific queries based on the results I receive." then
2. web_search ["Tesla", "Tesla latest news", "Tesla stock price"] then
3. __reasoning_preamble "Based on the previous search results, I will now narrow down my queries to focus on Tesla's recent developments and stock performance." then
4. web_search ["Tesla Q2 2025 earnings", "Tesla new model 2025", "Tesla stock analysis"] then done.
5. __reasoning_preamble "I have gathered enough information to provide a comprehensive answer."
6. done.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const qualityModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You have to call this tool several times to gather enough information unless the question is very simple (like greeting questions or basic facts).
Start with targeted queries about the user's actual subject, then refine based on the evidence returned.
Never stop before at least 5-6 iterations of searches unless the user question is very simple.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'web_search',
  schema: actionSchema,
  getToolDescription: () =>
    `Search the web with up to 3 targeted queries. ${queryGuidance}`,
  getDescription: (config) => {
    let prompt = '';

    switch (config.mode) {
      case 'speed':
        prompt = speedModePrompt;
        break;
      case 'balanced':
        prompt = balancedModePrompt;
        break;
      case 'quality':
        prompt = qualityModePrompt;
        break;
      default:
        prompt = speedModePrompt;
        break;
    }

    return `${prompt}\n${queryGuidance}`;
  },
  enabled: (config) =>
    config.sources.includes('web') &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    input.queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;

    if (!researchBlock) throw new Error('Failed to retrieve research block');

    const results = await executeSearch({
      llm: additionalConfig.llm,
      embedding: additionalConfig.embedding,
      mode: additionalConfig.mode,
      queries: input.queries,
      originalQuery: additionalConfig.followUp,
      researchBlock: researchBlock,
      session: additionalConfig.session,
    });

    return {
      type: 'search_results',
      results: results,
    };
  },
};

export default webSearchAction;
