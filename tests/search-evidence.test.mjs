// node --experimental-strip-types --test tests/search-evidence.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  selectSearchResults,
  formatSearchContext,
} from '../src/lib/utils/searchResults.ts';
import ActionRegistry from '../src/lib/agents/search/researcher/actions/registry.ts';

const chunk = (url, similarity = 0.9) => ({
  content: 'A feature mentioned in several sources',
  metadata: { title: 'Documentation', url, similarity, embedding: [1, 0] },
});

test('a low-similarity primary result survives noisy high-similarity results', () => {
  const official = chunk('https://code.claude.com/docs/en/workflows', 0.12);
  const groups = Array.from({ length: 3 }, (_, query) =>
    Array.from({ length: 25 }, (_, rank) =>
      chunk(`https://example.com/${query}/${rank}`),
    ),
  );
  groups[1][0] = official;

  const results = selectSearchResults(groups);
  assert.equal(results.length, 20);
  assert.ok(results.some((r) => r.metadata.url === official.metadata.url));
  for (const group of groups) {
    for (const top of group.slice(0, 3)) {
      assert.ok(results.some((r) => r.metadata.url === top.metadata.url));
    }
  }
  assert.ok(
    results.every(
      (r) => !('embedding' in r.metadata) && !('similarity' in r.metadata),
    ),
  );
  assert.deepEqual(
    official.metadata.embedding,
    [1, 0],
    'do not mutate research trace',
  );
});

test('deduplicates repeated URLs but keeps independent corroborating sources', () => {
  const results = selectSearchResults([
    [chunk('https://docs.example.com/feature?utm_source=search#usage')],
    [
      chunk('https://docs.example.com/feature'),
      chunk('https://other.example.com/feature'),
    ],
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[1].metadata.url, 'https://other.example.com/feature');
});

test('empty searches and embedding failures preserve deterministic engine order', () => {
  assert.deepEqual(selectSearchResults([[], []]), []);
  const group = Array.from({ length: 8 }, (_, i) =>
    chunk(`https://example.com/${i}`, undefined),
  );
  assert.deepEqual(
    selectSearchResults([group], 5).map((r) => r.metadata.url),
    group.slice(0, 5).map((r) => r.metadata.url),
  );
});

test('writer context retains URL, evidence type, and citation order', () => {
  const source = chunk('https://docs.example.com/feature');
  source.metadata.evidence = 'page extract';
  const context = formatSearchContext([source]);
  assert.ok(context.startsWith('<result index="1">'));
  const data = JSON.parse(
    context.slice(context.indexOf('>') + 1, context.lastIndexOf('<')),
  );
  assert.equal(data.url, source.metadata.url);
  assert.equal(data.evidence, 'page extract');
  assert.equal(data.content, source.content);
});

test('parallel tool outputs stay aligned with their tool call IDs', async () => {
  let finishSlow;
  ActionRegistry.register({
    name: 'test_slow',
    execute: () =>
      new Promise((resolve) => {
        finishSlow = resolve;
      }),
  });
  ActionRegistry.register({
    name: 'test_fast',
    execute: async () => ({ type: 'done' }),
  });
  const result = ActionRegistry.executeAll(
    [
      { id: 'slow-id', name: 'test_slow', arguments: {} },
      { id: 'fast-id', name: 'test_fast', arguments: {} },
    ],
    {},
  );
  await Promise.resolve();
  finishSlow({
    type: 'search_results',
    results: [chunk('https://docs.example.com')],
  });
  assert.deepEqual(
    (await result).map((r) => r.type),
    ['search_results', 'done'],
  );
});

// Compile the real modules with explicit dependency stubs so regressions can
// run offline without loading provider credentials, SQLite, or an LLM.
const loadModule = (path, dependencies) => {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const module = { exports: {} };
  runInNewContext(outputText, {
    module,
    exports: module.exports,
    crypto: globalThis.crypto,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
};

test('English web research does not inherit Korean-only search options; media still does', async () => {
  const { resolveSearchOptions } = loadModule('../src/lib/searchEngines.ts', {
    './config/serverRegistry': {
      getWebEngines: () => ['google'],
      getImageEngines: () => ['google images'],
      getVideoEngines: () => ['youtube'],
      getKoreanEngines: () => ['naver'],
      isKoreanBoostEnabled: () => true,
    },
    './searxng': { getSearxngEngines: async () => [] },
  });
  const english = await resolveSearchOptions(
    'claude ultracode documentation',
    'web',
    'claude ultra code 란?',
  );
  assert.equal(english.language, undefined);
  assert.equal(english.engines.join(','), 'google');
  const korean = await resolveSearchOptions('클로드 울트라코드', 'web');
  assert.equal(korean.language, 'ko');
  assert.equal(korean.engines.join(','), 'google,naver');
  const media = await resolveSearchOptions(
    'Seoul night',
    'images',
    '서울 야경',
  );
  assert.equal(media.language, 'ko');
  assert.equal(media.engines.join(','), 'google images,naver images');
});

test('a search batched with done is executed and reaches the final sources', async () => {
  const source = chunk('https://code.claude.com/docs/en/workflows');
  const page = {
    ...source,
    content: 'Full documentation extract',
    metadata: { ...source.metadata, evidence: 'page extract' },
  };
  const calls = [
    {
      id: 'search',
      name: 'web_search',
      arguments: { queries: ['claude ultracode'] },
    },
    { id: 'done', name: 'done', arguments: {} },
  ];
  let executed = false;
  const { default: Researcher } = loadModule(
    '../src/lib/agents/search/researcher/index.ts',
    {
      './actions': {
        ActionRegistry: {
          getAvailableActionTools: () => [],
          getAvailableActionsDescriptions: () => '',
          executeAll: async (actualCalls) => {
            assert.equal(actualCalls.length, 2);
            executed = true;
            return [
              { type: 'search_results', results: [source, page] },
              { type: 'done' },
            ];
          },
        },
      },
      '@/lib/prompts/search/researcher': { getResearcherPrompt: () => '' },
      '@/lib/utils/formatHistory': { default: () => '' },
    },
  );
  const blocks = [];
  const result = await new Researcher().research(
    {
      signal: { aborted: false },
      emitBlock: (block) => blocks.push(block),
      getBlock: (id) => blocks.find((b) => b.id === id),
      updateBlock: () => {},
    },
    {
      chatHistory: [],
      followUp: 'claude ultra code 란?',
      classification: { standaloneFollowUp: 'claude ultra code 란?' },
      config: {
        mode: 'speed',
        sources: ['web'],
        fileIds: [],
        llm: {
          async *streamText() {
            yield { toolCallChunk: calls };
          },
        },
      },
    },
  );
  assert.equal(executed, true);
  assert.equal(result.searchFindings[0].metadata.url, source.metadata.url);
  assert.equal(result.searchFindings.length, 1);
  assert.equal(result.searchFindings[0].metadata.evidence, 'page extract');
  assert.ok(
    result.searchFindings[0].content.includes('Full documentation extract'),
  );
  assert.equal(blocks.at(-1).type, 'source');
});
