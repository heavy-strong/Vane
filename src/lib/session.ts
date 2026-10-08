import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private events: { event: string; data: any }[] = [];
  private emitter = new EventEmitter();
  private abortController = new AbortController();
  private ended = false;
  private TTL_MS = 30 * 60 * 1000;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    setTimeout(() => {
      SessionManager.sessions.delete(this.id);
    }, this.TTL_MS);
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  static createSession(): SessionManager {
    const session = new SessionManager();
    this.sessions.set(session.id, session);
    return session;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get isEnded() {
    return this.ended;
  }

  abort() {
    if (this.ended) return;
    this.abortController.abort();
  }

  /* Resolves with null as soon as the session is aborted, so callers can stop
     waiting on work that can't be cancelled itself. */
  untilAborted<T>(promise: Promise<T>): Promise<T | null> {
    const signal = this.signal;

    if (signal.aborted) {
      promise.catch(() => {});
      return Promise.resolve(null);
    }

    return new Promise<T | null>((resolve, reject) => {
      const onAbort = () => resolve(null);
      signal.addEventListener('abort', onAbort, { once: true });

      promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (err) => {
          signal.removeEventListener('abort', onAbort);
          if (signal.aborted) resolve(null);
          else reject(err);
        },
      );
    });
  }

  emit(event: string, data: any) {
    // Work that outlives a stopped session must not append to its stream.
    if (this.ended) return;
    if (event === 'end' || event === 'error') this.ended = true;

    this.emitter.emit(event, data);
    this.events.push({ event, data });
  }

  emitBlock(block: Block) {
    if (this.ended) return;
    this.blocks.set(block.id, block);
    this.emit('data', {
      type: 'block',
      block: block,
    });
  }

  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  updateBlock(blockId: string, patch: any[]) {
    const block = this.blocks.get(blockId);

    if (block && !this.ended) {
      applyPatch(block, patch);
      this.blocks.set(blockId, block);
      this.emit('data', {
        type: 'updateBlock',
        blockId: blockId,
        patch: patch,
      });
    }
  }

  getAllBlocks() {
    return Array.from(this.blocks.values());
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    const currentEventsLength = this.events.length;

    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    for (let i = 0; i < currentEventsLength; i++) {
      const { event, data } = this.events[i];
      listener(event, data);
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
