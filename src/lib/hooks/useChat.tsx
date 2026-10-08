'use client';

import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { MinimalProvider, ReasoningEffort } from '../models/types';
import { getAutoMediaSearch } from '../config/clientRegistry';
import {
  notifySearchComplete,
  promptForNotificationPermission,
} from '../notifications';
import {
  getPreference,
  PREFERENCES_CHANGED_EVENT,
  PreferencesChangedDetail,
  removePreference,
  setPreference,
} from '../preferences/client';
import { applyPatch } from 'rfc6902';
import { Widget } from '@/components/ChatWindow';
import { notifyLibraryChanged } from '../library';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
  suggestionsLoading: boolean;
};

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  chatModelProvider: ChatModelProvider;
  chatThinkingEnabled?: boolean;
  chatReasoningEffort?: ReasoningEffort;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (message: string, messageId?: string) => Promise<void>;
  rewrite: (messageId: string, query?: string) => void;
  stopMessage: () => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setChatThinkingEnabled: (enabled?: boolean) => void;
  setChatReasoningEffort: (effort?: ReasoningEffort) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
  quotedText: string;
  setQuotedText: (text: string) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

type MessageHandler = ((data: any) => Promise<void>) & {
  flush: () => void;
};

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModelKey = localStorage.getItem('chatModelKey');
    let chatModelProviderId = localStorage.getItem('chatModelProviderId');
    let embeddingModelKey = localStorage.getItem('embeddingModelKey');
    let embeddingModelProviderId = localStorage.getItem(
      'embeddingModelProviderId',
    );

    const res = await fetch(`/api/providers`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(
        `Provider fetching failed with status code ${res.status}`,
      );
    }

    const data = await res.json();
    const providers: MinimalProvider[] = data.providers;

    if (providers.length === 0) {
      throw new Error(
        'No chat model providers found, please configure them in the settings page.',
      );
    }

    const storedChatModelProvider = providers.find(
      (p) => p.id === chatModelProviderId,
    );
    const chatModelProvider =
      (storedChatModelProvider?.chatModels.length ?? 0) > 0
        ? storedChatModelProvider
        : providers.find((p) => p.chatModels.length > 0);

    if (!chatModelProvider) {
      throw new Error(
        'No chat models found, pleae configure them in the settings page.',
      );
    }

    chatModelProviderId = chatModelProvider.id;

    const chatModel =
      chatModelProvider.chatModels.find((m) => m.key === chatModelKey) ??
      chatModelProvider.chatModels[0];
    chatModelKey = chatModel.key;

    const storedEmbeddingModelProvider = providers.find(
      (p) => p.id === embeddingModelProviderId,
    );
    const embeddingModelProvider =
      (storedEmbeddingModelProvider?.embeddingModels.length ?? 0) > 0
        ? storedEmbeddingModelProvider
        : providers.find((p) => p.embeddingModels.length > 0);

    if (!embeddingModelProvider) {
      throw new Error(
        'No embedding models found, pleae configure them in the settings page.',
      );
    }

    embeddingModelProviderId = embeddingModelProvider.id;

    const embeddingModel =
      embeddingModelProvider.embeddingModels.find(
        (m) => m.key === embeddingModelKey,
      ) ?? embeddingModelProvider.embeddingModels[0];
    embeddingModelKey = embeddingModel.key;

    setPreference('chatModelKey', chatModelKey);
    setPreference('chatModelProviderId', chatModelProviderId);
    setPreference('embeddingModelKey', embeddingModelKey);
    setPreference('embeddingModelProviderId', embeddingModelProviderId);

    setChatModelProvider({
      key: chatModelKey,
      providerId: chatModelProviderId,
    });

    setEmbeddingModelProvider({
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    });

    setIsConfigReady(true);
  } catch (err: any) {
    console.error('An error occurred while checking the configuration:', err);
    toast.error(err.message);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setHasError: (hasError: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  try {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      setNotFound(true);
      return;
    }

    if (!res.ok) {
      throw new Error(`Chat loading failed with status code ${res.status}`);
    }

    const data = await res.json();
    const messages = (data.messages ?? []) as Message[];

    setMessages(messages);

    const history: [string, string][] = [];
    messages.forEach((msg) => {
      history.push(['human', msg.query]);

      const textBlocks = msg.responseBlocks
        .filter(
          (block): block is Block & { type: 'text' } => block.type === 'text',
        )
        .map((block) => block.data)
        .join('\n');

      if (textBlocks) {
        history.push(['assistant', textBlocks]);
      }
    });

    console.debug(new Date(), 'app:messages_loaded');

    if (messages.length > 0) {
      document.title = messages[0].query;
    }

    const files = (data.chat?.files ?? []).map((file: any) => {
      return {
        fileName: file.name,
        fileExtension: file.name.split('.').pop(),
        fileId: file.fileId,
      };
    });

    setFiles(files);
    setFileIds(files.map((file: File) => file.fileId));

    chatHistory.current = history;
    setSources(data.chat?.sources ?? ['web']);
  } catch (err) {
    console.error('An error occurred while loading chat:', err);
    setHasError(true);
  } finally {
    setIsMessagesLoaded(true);
  }
};

/* Feeds each newline-delimited JSON event of an answer stream to `handle`.
   A line split across chunks is held back until it is complete, so no event
   is ever handled twice. */
const readEventStream = async (
  body: ReadableStream<Uint8Array>,
  handle: (data: any) => void,
) => {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffered = '';

  const handleLine = (line: string) => {
    if (!line.trim()) return;

    let data: any;
    try {
      data = JSON.parse(line);
    } catch (err) {
      console.warn('Skipping malformed stream event:', line);
      return;
    }

    handle(data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });

    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    lines.forEach(handleLine);
  }

  handleLine(buffered + decoder.decode());
};

/** Fired with a message id when its images and videos should be fetched. */
export const AUTO_MEDIA_SEARCH_EVENT = 'vane:auto-media-search';

// How often a streaming answer is rendered. Updates arriving in between are
// merged, since rendering on every token keeps the page too busy to respond.
const STREAM_RENDER_INTERVAL_MS = 50;

const buildSection = (msg: Message, suggestionsLoading: boolean): Section => {
  const textBlocks: string[] = [];
  let speechMessage = '';
  let thinkingEnded = false;
  let suggestions: string[] = [];

  const sourceBlocks = msg.responseBlocks.filter(
    (block): block is Block & { type: 'source' } => block.type === 'source',
  );
  const sources = sourceBlocks.flatMap((block) => block.data);

  const widgetBlocks = msg.responseBlocks
    .filter((b) => b.type === 'widget')
    .map((b) => b.data) as Widget[];

  msg.responseBlocks.forEach((block) => {
    if (block.type === 'text') {
      let processedText = block.data;
      const citationRegex = /(?<!\\)\[([^\]]+)\]/g;
      const regex = /\[(\d+)\]/g;

      if (processedText.includes('<think>')) {
        const openThinkTag = processedText.match(/<think>/g)?.length || 0;
        const closeThinkTag = processedText.match(/<\/think>/g)?.length || 0;

        if (openThinkTag && !closeThinkTag) {
          processedText += '</think> <a> </a>';
        }
      }

      if (block.data.includes('</think>')) {
        thinkingEnded = true;
      }

      if (sources.length > 0) {
        processedText = processedText.replace(
          citationRegex,
          (_, capturedContent: string) => {
            const numbers = capturedContent
              .split(',')
              .map((numStr) => numStr.trim());

            const linksHtml = numbers
              .map((numStr) => {
                const number = parseInt(numStr);

                if (isNaN(number) || number <= 0) {
                  return `[${numStr}]`;
                }

                const source = sources[number - 1];
                const url = source?.metadata?.url;

                if (url) {
                  return `<citation href="${url}">${numStr}</citation>`;
                } else {
                  return ``;
                }
              })
              .join('');

            return linksHtml;
          },
        );
        speechMessage += block.data.replace(regex, '');
      } else {
        processedText = processedText.replace(regex, '');
        speechMessage += block.data.replace(regex, '');
      }

      textBlocks.push(processedText);
    } else if (block.type === 'suggestion') {
      suggestions = block.data;
    }
  });

  return {
    message: msg,
    parsedTextBlocks: textBlocks,
    speechMessage,
    thinkingEnded,
    suggestions,
    suggestionsLoading,
    widgets: widgetBlocks,
  };
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  chatThinkingEnabled: undefined,
  chatReasoningEffort: undefined,
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  rewrite: () => {},
  stopMessage: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setChatThinkingEnabled: () => {},
  setChatReasoningEffort: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
  quotedText: '',
  setQuotedText: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const routeChatId = pathname.match(/^\/c\/([^/]+)/)?.[1];

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(routeChatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  // Chat whose answer is being generated. One answer streams at a time, and
  // it keeps streaming while other pages or chats are open.
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const loading = streamingChatId !== null && streamingChatId === chatId;
  const [suggestionsLoadingId, setSuggestionsLoadingId] = useState<
    string | null
  >(null);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [quotedText, setQuotedText] = useState('');

  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState('speed');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );
  const [chatReasoningEffort, setChatReasoningEffort] = useState<
    ReasoningEffort | undefined
  >();
  const [chatThinkingEnabled, setChatThinkingEnabled] = useState<boolean>();

  useEffect(() => {
    const savedEffort = localStorage.getItem('chatReasoningEffort');
    const savedThinking = localStorage.getItem('chatThinkingEnabled');
    if (savedThinking === 'true' || savedThinking === 'false') {
      setChatThinkingEnabled(savedThinking === 'true');
    }
    if (savedEffort === 'none') {
      setChatThinkingEnabled(false);
      setPreference('chatThinkingEnabled', 'false');
      removePreference('chatReasoningEffort');
    } else if (
      savedEffort &&
      ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(
        savedEffort,
      )
    ) {
      setChatReasoningEffort(savedEffort as ReasoningEffort);
    }
  }, []);

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  // Model choices made in another client (another browser, Vane Desktop) apply here too.
  useEffect(() => {
    const onChange = (event: Event) => {
      const { keys, remote } = (event as CustomEvent<PreferencesChangedDetail>)
        .detail;
      if (!remote) return;
      const read = (key: string) => getPreference(key) ?? '';
      if (
        keys.includes('chatModelKey') ||
        keys.includes('chatModelProviderId')
      ) {
        if (read('chatModelKey') && read('chatModelProviderId')) {
          setChatModelProvider({
            key: read('chatModelKey'),
            providerId: read('chatModelProviderId'),
          });
        }
      }
      if (
        keys.includes('embeddingModelKey') ||
        keys.includes('embeddingModelProviderId')
      ) {
        if (read('embeddingModelKey') && read('embeddingModelProviderId')) {
          setEmbeddingModelProvider({
            key: read('embeddingModelKey'),
            providerId: read('embeddingModelProviderId'),
          });
        }
      }
      if (keys.includes('chatThinkingEnabled')) {
        const thinking = read('chatThinkingEnabled');
        setChatThinkingEnabled(
          thinking === '' ? undefined : thinking === 'true',
        );
      }
      if (keys.includes('chatReasoningEffort')) {
        setChatReasoningEffort(
          (read('chatReasoningEffort') || undefined) as
            | ReasoningEffort
            | undefined,
        );
      }
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange);
  }, []);

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  // Sections are kept per message object, so while one message streams in
  // the others keep theirs (and their rendered output) instead of being
  // parsed again on every update.
  const sectionCache = useRef(new WeakMap<Message, Section>());

  const sections = useMemo<Section[]>(() => {
    return messages.map((msg) => {
      const suggestionsLoading = suggestionsLoadingId === msg.messageId;
      const cached = sectionCache.current.get(msg);

      if (cached && cached.suggestionsLoading === suggestionsLoading) {
        return cached;
      }

      const section = buildSection(msg, suggestionsLoading);
      sectionCache.current.set(msg, section);
      return section;
    });
  }, [messages, suggestionsLoadingId]);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  // Server session of the answer being streamed, used to stop it.
  const activeSessionIdRef = useRef<string | null>(null);
  // Set when stop is pressed before the server has reported the session id.
  const stopRequestedRef = useRef(false);

  // The answer this client is currently reading a stream for.
  const activeStreamRef = useRef<{
    messageId: string;
    handler: MessageHandler;
  } | null>(null);

  const readAnswerStream = async (
    body: ReadableStream<Uint8Array>,
    message: Message,
  ) => {
    const handler = getMessageHandler(message);
    activeStreamRef.current = { messageId: message.messageId, handler };

    try {
      await readEventStream(body, handler);
    } finally {
      handler.flush();
      if (activeStreamRef.current?.handler === handler) {
        activeStreamRef.current = null;
      }
    }
  };

  const checkReconnect = async () => {
    if (isReconnectingRef.current) return;

    setIsReady(true);
    console.debug(new Date(), 'app:ready');

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setStreamingChatId(lastMsg.chatId);

        // This client is still reading the answer (the chat was left and
        // opened again), so show what it has instead of a second stream.
        const activeStream = activeStreamRef.current;
        if (activeStream?.messageId === lastMsg.messageId) {
          activeStream.handler.flush();
          return;
        }

        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;
        activeSessionIdRef.current = lastMsg.backendId;
        stopRequestedRef.current = false;

        try {
          const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
            method: 'POST',
          });

          // The server no longer has the session, so nothing will end it.
          if (!res.ok || !res.body) {
            setStreamingChatId(null);
            return;
          }

          await readAnswerStream(res.body, lastMsg);
        } finally {
          isReconnectingRef.current = false;
        }
      }
    }
  };

  useEffect(() => {
    checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  useEffect(() => {
    // Only a new chat or a different one starts over. Other pages keep the
    // open chat, and any answer streaming into it, so coming back shows it
    // straight away; and a new chat's URL becoming /c/<id> once its first
    // message is sent is still the same chat.
    if (routeChatId ? routeChatId === chatIdRef.current : pathname !== '/') {
      return;
    }

    setChatId(routeChatId);
    setMessages([]);
    chatHistory.current = [];
    setFiles([]);
    setFileIds([]);
    setQuotedText('');
    setSources(['web']);
    setIsMessagesLoaded(false);
    setNotFound(false);
    setNewChatCreated(false);
  }, [pathname, routeChatId]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        chatHistory,
        setSources,
        setNotFound,
        setHasError,
        setFiles,
        setFileIds,
      );
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (isMessagesLoaded && isConfigReady && !newChatCreated) {
      checkReconnect();
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady, newChatCreated]);

  /* Answers the message again, with `query` in place of the original
     question when it was edited. Every later message is dropped. */
  const rewrite = (messageId: string, query?: string) => {
    if (streamingChatId) return;

    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    setMessages((prev) => prev.slice(0, index));

    chatHistory.current = chatHistory.current.slice(0, index * 2);

    const messageToRewrite = messages[index];
    sendMessage(query ?? messageToRewrite.query, messageToRewrite.messageId);
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      if (!isConfigReady) {
        toast.error('Cannot send message before the configuration is ready');
        return;
      }
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  /* Applies the events of one answer's stream. The message is updated here
     as events arrive and rendered at most every STREAM_RENDER_INTERVAL_MS;
     `flush` renders it right away. */
  const getMessageHandler = (message: Message): MessageHandler => {
    const messageId = message.messageId;

    let current = message;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }

      const latest = current;
      setMessages((prev) =>
        prev.map((msg) => (msg.messageId === messageId ? latest : msg)),
      );
    };

    const update = (
      change: (msg: Message) => Message,
      { immediate = false } = {},
    ) => {
      current = change(current);

      if (immediate) {
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, STREAM_RENDER_INTERVAL_MS);
      }
    };

    const updateBlock = (blockId: string, change: (block: Block) => Block) =>
      update((msg) => ({
        ...msg,
        responseBlocks: msg.responseBlocks.map((block) =>
          block.id === blockId ? change(block) : block,
        ),
      }));

    const handle = async (data: any) => {
      if (data.type === 'session') {
        activeSessionIdRef.current = data.sessionId;
        update((msg) => ({ ...msg, backendId: data.sessionId }), {
          immediate: true,
        });
        if (stopRequestedRef.current) requestStop(data.sessionId);
        return;
      }

      if (data.type === 'error') {
        activeSessionIdRef.current = null;
        stopRequestedRef.current = false;
        toast.error(data.data);
        setStreamingChatId(null);
        update((msg) => ({ ...msg, status: 'error' as const }), {
          immediate: true,
        });
        return;
      }

      if (data.type === 'modelInfo') {
        update((msg) => ({
          ...msg,
          modelName: data.modelName,
          modelProvider: data.modelProvider,
        }));
      }

      if (data.type === 'researchComplete') {
        setResearchEnded(true);
        if (
          current.responseBlocks.find(
            (b) => b.type === 'source' && b.data.length > 0,
          )
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'block') {
        update((msg) => {
          const exists = msg.responseBlocks.findIndex(
            (b) => b.id === data.block.id,
          );

          if (exists !== -1) {
            const existingBlocks = [...msg.responseBlocks];
            existingBlocks[exists] = data.block;

            return {
              ...msg,
              responseBlocks: existingBlocks,
            };
          }

          return {
            ...msg,
            responseBlocks: [...msg.responseBlocks, data.block],
          };
        });

        if (
          (data.block.type === 'source' && data.block.data.length > 0) ||
          data.block.type === 'text'
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'updateBlock') {
        updateBlock(data.blockId, (block) => {
          const updatedBlock = { ...block };
          applyPatch(updatedBlock, data.patch);
          return updatedBlock;
        });
      }

      if (data.type === 'appendText') {
        updateBlock(data.blockId, (block) =>
          block.type === 'text'
            ? { ...block, data: block.data + data.delta }
            : block,
        );
      }

      if (data.type === 'messageEnd') {
        if (handledMessageEndRef.current.has(messageId)) {
          return;
        }

        handledMessageEndRef.current.add(messageId);

        activeSessionIdRef.current = null;
        stopRequestedRef.current = false;

        const stopped = data.stopped === true;

        // The answer may finish while another chat is open, whose history
        // this must not touch.
        const isOpenChat = chatIdRef.current === message.chatId;

        const newHistory: [string, string][] = [
          ...(isOpenChat ? chatHistory.current : []),
          ['human', message.query],
          [
            'assistant',
            current.responseBlocks.find((b) => b.type === 'text')?.data || '',
          ],
        ];

        if (isOpenChat) chatHistory.current = newHistory;

        if (!stopped) {
          notifySearchComplete(
            message.query,
            newHistory[newHistory.length - 1][1],
          );
        }

        update(
          (msg) => ({
            ...msg,
            status: 'completed' as const,
            durationMs:
              typeof data.durationMs === 'number'
                ? data.durationMs
                : msg.durationMs,
          }),
          { immediate: true },
        );

        setStreamingChatId(null);

        if (stopped) return;

        const autoMediaSearch = getAutoMediaSearch();

        if (autoMediaSearch) {
          window.dispatchEvent(
            new CustomEvent(AUTO_MEDIA_SEARCH_EVENT, { detail: messageId }),
          );
        }

        // Suggest follow-up questions once the answer has some text

        const hasAnswer = newHistory[newHistory.length - 1][1].trim() !== '';
        const hasSuggestions = current.responseBlocks.some(
          (block) => block.type === 'suggestion',
        );

        if (hasAnswer && !hasSuggestions) {
          setSuggestionsLoadingId(messageId);

          const suggestions = await getSuggestions(newHistory, {
            chatId: message.chatId,
            messageId,
          });

          setSuggestionsLoadingId((id) => (id === messageId ? null : id));

          if (suggestions.length === 0) return;

          const suggestionBlock: Block = {
            id: crypto.randomBytes(7).toString('hex'),
            type: 'suggestion',
            data: suggestions,
          };

          update(
            (msg) => ({
              ...msg,
              responseBlocks: [...msg.responseBlocks, suggestionBlock],
            }),
            { immediate: true },
          );
        }
      }
    };

    return Object.assign(handle, { flush });
  };

  const requestStop = async (sessionId: string) => {
    stopRequestedRef.current = false;

    try {
      const res = await fetch(`/api/stop/${sessionId}`, { method: 'POST' });
      // On success the stream ends with a stopped messageEnd event.
      if (res.ok) return;
      if (res.status !== 404) {
        throw new Error(`Stopping failed with status code ${res.status}`);
      }
    } catch (err) {
      console.error('An error occurred while stopping the answer:', err);
      toast.error('Failed to stop the answer.');
      return;
    }

    // The server no longer has the session, so nothing will end the stream.
    const activeStream = activeStreamRef.current;
    if (activeStream) {
      activeStream.handler({ type: 'messageEnd', stopped: true });
    } else {
      setStreamingChatId(null);
    }
  };

  const stopMessage = () => {
    if (!loading) return;

    const message = messagesRef.current[messagesRef.current.length - 1];
    if (!message || message.status !== 'answering') return;

    const sessionId = activeSessionIdRef.current;

    if (sessionId) {
      requestStop(sessionId);
    } else {
      stopRequestedRef.current = true;
    }
  };

  const sendMessage: ChatContext['sendMessage'] = async (
    message,
    messageId,
  ) => {
    if (!message) return;
    if (streamingChatId) {
      if (streamingChatId !== chatId) {
        toast.error('Wait for the answer in the other chat to finish.');
      }
      return;
    }
    if (!chatModelProvider.providerId || !chatModelProvider.key) {
      toast.error('Select a chat model before sending a message.');
      return;
    }
    if (!embeddingModelProvider.providerId || !embeddingModelProvider.key) {
      toast.error('Select an embedding model before sending a message.');
      return;
    }
    promptForNotificationPermission();
    activeSessionIdRef.current = null;
    stopRequestedRef.current = false;
    setStreamingChatId(chatId!);
    setResearchEnded(false);
    setMessageAppeared(false);

    if (messages.length <= 1) {
      window.history.replaceState(null, '', `/c/${chatId}`);
    }

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');
    // A rewritten answer reuses the id of the one it replaces.
    handledMessageEndRef.current.delete(messageId);
    const backendId = crypto.randomBytes(20).toString('hex');

    const newMessage: Message = {
      messageId,
      chatId: chatId!,
      backendId,
      query: message,
      responseBlocks: [],
      status: 'answering',
      createdAt: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    const isFirstMessage = messages.length === 0;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        message: {
          messageId: messageId,
          chatId: chatId!,
          content: message,
        },
        chatId: chatId!,
        files: fileIds,
        sources: sources,
        optimizationMode: optimizationMode,
        // rewrite() has already cut the history back to this message.
        history: chatHistory.current,
        chatModel: {
          key: chatModelProvider.key,
          providerId: chatModelProvider.providerId,
        },
        reasoning:
          chatThinkingEnabled !== undefined || chatReasoningEffort
            ? {
                enabled: chatThinkingEnabled ?? true,
                effort:
                  chatThinkingEnabled === false
                    ? undefined
                    : chatReasoningEffort,
              }
            : undefined,
        embeddingModel: {
          key: embeddingModelProvider.key,
          providerId: embeddingModelProvider.providerId,
        },
        systemInstructions: localStorage.getItem('systemInstructions'),
        // Only used by the server when the chat is created; a new chat started
        // from a project page (`/?project=<id>`) is saved into that project.
        projectId: isFirstMessage ? searchParams.get('project') : undefined,
      }),
    });

    if (!res.body) throw new Error('No response body');

    if (isFirstMessage && res.ok) {
      notifyLibraryChanged();
    }

    await readAnswerStream(res.body, newMessage);
  };

  return (
    <chatContext.Provider
      value={{
        messages,
        sections,
        chatHistory: chatHistory.current,
        files,
        fileIds,
        sources,
        chatId,
        hasError,
        isMessagesLoaded,
        isReady,
        loading,
        messageAppeared,
        notFound,
        optimizationMode,
        setFileIds,
        setFiles,
        setSources,
        setOptimizationMode,
        rewrite,
        sendMessage,
        stopMessage,
        setChatModelProvider,
        chatModelProvider,
        chatThinkingEnabled,
        setChatThinkingEnabled,
        chatReasoningEffort,
        setChatReasoningEffort,
        embeddingModelProvider,
        setEmbeddingModelProvider,
        researchEnded,
        setResearchEnded,
        quotedText,
        setQuotedText,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};
