import preferenceStore from '@/lib/preferences/store';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Server-sent events: the full snapshot on connect and after every change. */
export const GET = async (req: NextRequest) => {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const sendSnapshot = (snapshot: object) =>
        send(`data: ${JSON.stringify(snapshot)}\n\n`);

      sendSnapshot(preferenceStore.get());
      const unsubscribe = preferenceStore.subscribe(sendSnapshot);
      // Keeps proxies and idle webviews from dropping the connection.
      const ping = setInterval(() => send(': ping\n\n'), 25000);

      cleanup = () => {
        unsubscribe();
        clearInterval(ping);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};
