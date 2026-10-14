const RETRY_DELAYS_MS = [1000, 2000];

type FollowUpEndpoint = '/api/suggestions' | '/api/images' | '/api/videos';

/** These requests can be repeated if the desktop webview loses its connection. */
export const requestFollowUp = async <T>(
  endpoint: FollowUpEndpoint,
  body: unknown,
): Promise<T> => {
  // Keep the model and history identical across retries.
  const payload = JSON.stringify(body);

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message =
          typeof data?.message === 'string' ? data.message : res.statusText;
        throw new Error(`${endpoint} failed (${res.status}): ${message}`);
      }

      return (await res.json()) as T;
    } catch (error) {
      // fetch rejects with TypeError on transport failures ("Load failed" in
      // WebKit). HTTP errors, invalid JSON and aborts must not repeat model calls.
      if (!(error instanceof TypeError)) throw error;

      if (attempt === RETRY_DELAYS_MS.length) {
        throw new Error(
          `${endpoint}: Could not reach the Vane server after ${attempt + 1} attempts. Check the server connection. (${error.message})`,
          { cause: error },
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
      );
    }
  }
};
