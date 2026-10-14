// Run with Node 22+: node --experimental-strip-types --test tests/follow-up-requests.test.mjs
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { requestFollowUp } from '../src/lib/followUpRequest.ts';

afterEach(() => mock.restoreAll());

test('all three follow-ups recover from a dropped connection with the same payload', async () => {
  const requests = new Map();
  mock.method(globalThis, 'fetch', async (endpoint, init) => {
    const bodies = requests.get(endpoint) ?? [];
    bodies.push(init.body);
    requests.set(endpoint, bodies);
    if (bodies.length === 1) throw new TypeError('Load failed');
    return Response.json({ results: ['recovered'] });
  });

  const body = {
    query: '서울 야경',
    chatModel: { providerId: 'test', key: 'test' },
  };
  const endpoints = ['/api/suggestions', '/api/images', '/api/videos'];
  const results = await Promise.all(
    endpoints.map((endpoint) => requestFollowUp(endpoint, body)),
  );

  assert.deepEqual(
    results,
    endpoints.map(() => ({ results: ['recovered'] })),
  );
  for (const endpoint of endpoints) {
    assert.deepEqual(requests.get(endpoint), [
      JSON.stringify(body),
      JSON.stringify(body),
    ]);
  }
});

test('persistent connection failures stop and identify the failed API', async () => {
  const failure = new TypeError('Load failed');
  const fetch = mock.method(globalThis, 'fetch', async () => {
    throw failure;
  });

  await assert.rejects(requestFollowUp('/api/images', {}), (error) => {
    assert.match(error.message, /\/api\/images.*after 3 attempts/);
    assert.equal(error.cause, failure);
    return true;
  });
  assert.equal(fetch.mock.callCount(), 3);
});

test('server errors preserve the status and message without repeating model calls', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () =>
    Response.json({ message: 'Invalid provider id' }, { status: 500 }),
  );

  await assert.rejects(
    requestFollowUp('/api/suggestions', {}),
    /\/api\/suggestions failed \(500\): Invalid provider id/,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test('invalid responses and intentional aborts are not retried', async () => {
  const fetch = mock.method(
    globalThis,
    'fetch',
    async () => new Response('invalid json', { status: 200 }),
  );
  await assert.rejects(requestFollowUp('/api/videos', {}), SyntaxError);
  assert.equal(fetch.mock.callCount(), 1);

  fetch.mock.mockImplementation(async () => {
    throw new DOMException('Request aborted', 'AbortError');
  });
  await assert.rejects(requestFollowUp('/api/videos', {}), {
    name: 'AbortError',
  });
  assert.equal(fetch.mock.callCount(), 2);
});

test('a connection lost while reading a successful response also recovers', async () => {
  let attempts = 0;
  mock.method(globalThis, 'fetch', async () => {
    if (++attempts === 1) {
      return {
        ok: true,
        json: async () => {
          throw new TypeError('Load failed');
        },
      };
    }
    return Response.json({ videos: ['recovered'] });
  });

  assert.deepEqual(await requestFollowUp('/api/videos', {}), {
    videos: ['recovered'],
  });
  assert.equal(attempts, 2);
});
