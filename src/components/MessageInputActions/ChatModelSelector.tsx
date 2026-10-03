'use client';

import { Cpu, Loader2, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FAVORITES_CHANGED_EVENT,
  FavoriteChatModel,
  isFavoriteChatModel,
  readFavoriteChatModels,
  toggleFavoriteChatModel,
} from '@/lib/models/favorites';
import { MinimalProvider, Model, ReasoningEffort } from '@/lib/models/types';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

const ModelSelector = ({ align = 'end' }: { align?: 'start' | 'end' }) => {
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<FavoriteChatModel[]>([]);

  const {
    setChatModelProvider,
    chatModelProvider,
    chatThinkingEnabled,
    setChatThinkingEnabled,
    chatReasoningEffort,
    setChatReasoningEffort,
    embeddingModelProvider,
    setEmbeddingModelProvider,
  } = useChat();

  const chatModelProviderRef = useRef(chatModelProvider);
  const embeddingModelProviderRef = useRef(embeddingModelProvider);
  const searchObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    chatModelProviderRef.current = chatModelProvider;
    embeddingModelProviderRef.current = embeddingModelProvider;
  }, [chatModelProvider, embeddingModelProvider]);

  const setSearchHeaderRef = useCallback((node: HTMLDivElement | null) => {
    searchObserverRef.current?.disconnect();
    searchObserverRef.current = null;
    if (!node) return;

    const scrollParent = node.closest('[data-anchor]');
    if (!(scrollParent instanceof HTMLElement)) return;

    const apply = () => {
      scrollParent.style.setProperty(
        '--model-search-offset',
        `${node.offsetHeight}px`,
      );
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    searchObserverRef.current = observer;
  }, []);

  useEffect(() => {
    const syncFavorites = () => setFavorites(readFavoriteChatModels());
    syncFavorites();
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    window.addEventListener('storage', syncFavorites);

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
      window.removeEventListener('storage', syncFavorites);
    };
  }, []);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/providers', { cache: 'no-store' });

        if (!res.ok) {
          throw new Error('Failed to fetch providers');
        }

        const data: { providers: MinimalProvider[] } = await res.json();
        setProviders(data.providers);

        const currentChat = chatModelProviderRef.current;
        const chatIsValid = data.providers.some(
          (provider) =>
            provider.id === currentChat.providerId &&
            provider.chatModels.some((model) => model.key === currentChat.key),
        );
        if (!chatIsValid) {
          const fallbackProvider = data.providers.find(
            (provider) => provider.chatModels.length > 0,
          );
          const fallbackModel = fallbackProvider?.chatModels[0];
          const nextChat = {
            providerId: fallbackProvider?.id ?? '',
            key: fallbackModel?.key ?? '',
          };
          chatModelProviderRef.current = nextChat;
          setChatModelProvider(nextChat);
          if (fallbackModel) {
            localStorage.setItem('chatModelProviderId', nextChat.providerId);
            localStorage.setItem('chatModelKey', nextChat.key);
          } else {
            localStorage.removeItem('chatModelProviderId');
            localStorage.removeItem('chatModelKey');
          }
          setChatThinkingEnabled(undefined);
          setChatReasoningEffort(undefined);
          localStorage.removeItem('chatThinkingEnabled');
          localStorage.removeItem('chatReasoningEffort');
        }

        const currentEmbedding = embeddingModelProviderRef.current;
        const embeddingIsValid = data.providers.some(
          (provider) =>
            provider.id === currentEmbedding.providerId &&
            provider.embeddingModels.some(
              (model) => model.key === currentEmbedding.key,
            ),
        );
        if (!embeddingIsValid) {
          const fallbackProvider = data.providers.find(
            (provider) => provider.embeddingModels.length > 0,
          );
          const fallbackModel = fallbackProvider?.embeddingModels[0];
          const nextEmbedding = {
            providerId: fallbackProvider?.id ?? '',
            key: fallbackModel?.key ?? '',
          };
          embeddingModelProviderRef.current = nextEmbedding;
          setEmbeddingModelProvider(nextEmbedding);
          if (fallbackModel) {
            localStorage.setItem(
              'embeddingModelProviderId',
              nextEmbedding.providerId,
            );
            localStorage.setItem('embeddingModelKey', nextEmbedding.key);
          } else {
            localStorage.removeItem('embeddingModelProviderId');
            localStorage.removeItem('embeddingModelKey');
          }
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProviders();
    window.addEventListener('providers-changed', loadProviders);

    return () => {
      window.removeEventListener('providers-changed', loadProviders);
    };
  }, [
    setChatModelProvider,
    setChatReasoningEffort,
    setChatThinkingEnabled,
    setEmbeddingModelProvider,
  ]);

  const orderedProviders = useMemo(() => {
    if (!chatModelProvider?.providerId) return providers;

    const currentProviderIndex = providers.findIndex(
      (p) => p.id === chatModelProvider.providerId,
    );

    if (currentProviderIndex === -1) {
      return providers;
    }

    const selectedProvider = providers[currentProviderIndex];
    const remainingProviders = providers.filter(
      (_, index) => index !== currentProviderIndex,
    );

    return [selectedProvider, ...remainingProviders];
  }, [providers, chatModelProvider]);

  const handleModelSelect = (providerId: string, modelKey: string) => {
    setChatModelProvider({ providerId, key: modelKey });
    localStorage.setItem('chatModelProviderId', providerId);
    localStorage.setItem('chatModelKey', modelKey);

    const model = providers
      .find((provider) => provider.id === providerId)
      ?.chatModels.find((candidate) => candidate.key === modelKey);
    if (
      chatReasoningEffort &&
      !model?.reasoning?.supportedEfforts?.includes(chatReasoningEffort)
    ) {
      setChatReasoningEffort(undefined);
      localStorage.removeItem('chatReasoningEffort');
    }
    if (!model?.reasoning) {
      setChatThinkingEnabled(undefined);
      localStorage.removeItem('chatThinkingEnabled');
    }
  };

  const selectedProvider = providers.find(
    (provider) => provider.id === chatModelProvider?.providerId,
  );
  const selectedModel = selectedProvider?.chatModels.find(
    (model) => model.key === chatModelProvider?.key,
  );
  const supportedEfforts = (
    selectedModel?.reasoning?.supportedEfforts ?? []
  ).filter((effort) => effort !== 'none');

  const handleEffortChange = (effort: string) => {
    const value = effort ? (effort as ReasoningEffort) : undefined;
    setChatReasoningEffort(value);
    if (value) localStorage.setItem('chatReasoningEffort', value);
    else localStorage.removeItem('chatReasoningEffort');
  };

  const handleThinkingChange = (value: string) => {
    const enabled = value === '' ? undefined : value === 'on';
    setChatThinkingEnabled(enabled);
    if (enabled === undefined) localStorage.removeItem('chatThinkingEnabled');
    else localStorage.setItem('chatThinkingEnabled', String(enabled));
  };

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (providerName: string, model: Model) =>
    !query ||
    model.name.toLowerCase().includes(query) ||
    model.key.toLowerCase().includes(query) ||
    providerName.toLowerCase().includes(query);

  const favoriteModels = orderedProviders.flatMap((provider) =>
    provider.chatModels
      .filter(
        (model) =>
          isFavoriteChatModel(favorites, provider.id, model.key) &&
          matchesQuery(provider.name, model),
      )
      .map((model) => ({ provider, model })),
  );

  const filteredProviders = orderedProviders
    .map((provider) => ({
      ...provider,
      chatModels: provider.chatModels.filter((model) =>
        matchesQuery(provider.name, model),
      ),
    }))
    .filter((provider) => provider.chatModels.length > 0);

  const renderModelRow = (
    providerId: string,
    providerName: string,
    model: Model,
    showProviderName = false,
  ) => {
    const selected =
      chatModelProvider?.providerId === providerId &&
      chatModelProvider?.key === model.key;
    const favorited = isFavoriteChatModel(favorites, providerId, model.key);

    return (
      <div
        key={`${showProviderName ? 'favorite' : 'model'}-${providerId}-${model.key}`}
        className={cn(
          'flex items-center rounded-lg',
          selected
            ? 'bg-light-secondary dark:bg-dark-secondary'
            : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
        )}
      >
        <button
          onClick={() => handleModelSelect(providerId, model.key)}
          type="button"
          className="flex min-w-0 flex-1 items-center px-3 py-2 text-start"
        >
          <div className="flex min-w-0 flex-1 items-center space-x-2.5">
            <Cpu
              size={15}
              className={cn(
                'shrink-0',
                selected ? 'text-sky-500' : 'text-black/50 dark:text-white/50',
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-xs',
                  selected
                    ? 'font-medium text-sky-500'
                    : 'text-black/70 dark:text-white/70',
                )}
              >
                {showProviderName
                  ? `${providerName} · ${model.name}`
                  : model.name}
              </p>
              {(query || model.key.includes('/')) && (
                <p className="truncate text-[10px] text-black/40 dark:text-white/40">
                  {model.key}
                </p>
              )}
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-label={
            favorited
              ? `Remove ${model.name} from favorites`
              : `Favorite ${model.name}`
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleFavoriteChatModel(providerId, model.key);
          }}
          className="mr-1 shrink-0 rounded-md p-1.5 text-black/30 transition hover:text-amber-500 dark:text-white/30"
        >
          <Star
            size={13}
            className={cn(favorited && 'fill-amber-400 text-amber-400')}
          />
        </button>
      </div>
    );
  };

  return (
    <Popover className="relative shrink-0">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 flex max-w-[10rem] items-center gap-1.5 rounded-lg p-2 text-black/50 transition duration-200 hover:text-black active:scale-95 focus:outline-none headless-open:text-black dark:text-white/50 dark:hover:text-white sm:max-w-[14rem]"
          >
            <Cpu size={16} className="text-sky-500" />
            <span className="truncate text-xs text-black/70 dark:text-white/70">
              {selectedModel
                ? `${selectedProvider?.name ?? 'Model'} · ${selectedModel.name}`
                : 'Select model'}
            </span>
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                portal
                anchor={{
                  to: align === 'start' ? 'top start' : 'top end',
                  gap: 8,
                  padding: 12,
                }}
                className="z-[60] w-[min(340px,calc(100vw-1.5rem))] rounded-lg border border-light-200 bg-light-primary shadow-lg outline-none [--anchor-max-height:min(70vh,480px)] dark:border-dark-200 dark:bg-dark-primary"
                static
              >
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="flex w-full flex-col"
                >
                  <div
                    ref={setSearchHeaderRef}
                    className="sticky top-0 z-20 border-b border-light-200 bg-light-primary p-2 dark:border-dark-200 dark:bg-dark-primary"
                  >
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                      />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="w-full pl-8 pr-3 py-2 bg-light-secondary dark:bg-dark-secondary rounded-lg placeholder:text-xs placeholder:-translate-y-[1.5px] text-xs text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none border border-transparent transition duration-200"
                      />
                    </div>
                    {selectedModel?.reasoning && (
                      <div className="mt-2 grid grid-cols-2 gap-2 px-1">
                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-black/50 dark:text-white/50">
                          Thinking
                          <select
                            value={
                              chatThinkingEnabled === undefined
                                ? ''
                                : chatThinkingEnabled
                                  ? 'on'
                                  : 'off'
                            }
                            onChange={(event) =>
                              handleThinkingChange(event.target.value)
                            }
                            className="min-w-0 rounded-md border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary px-2 py-1.5 text-xs text-black dark:text-white focus:outline-none"
                          >
                            <option value="">Default</option>
                            <option value="on">On</option>
                            {!selectedModel?.reasoning?.mandatory && (
                              <option value="off">Off</option>
                            )}
                          </select>
                        </label>
                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-black/50 dark:text-white/50">
                          Effort
                          <select
                            value={chatReasoningEffort ?? ''}
                            onChange={(event) =>
                              handleEffortChange(event.target.value)
                            }
                            disabled={chatThinkingEnabled === false}
                            className="min-w-0 rounded-md border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary px-2 py-1.5 text-xs text-black dark:text-white disabled:opacity-50 focus:outline-none"
                          >
                            <option value="">Model default</option>
                            {supportedEfforts.map((effort) => (
                              <option key={effort} value={effort}>
                                {effort}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="overscroll-contain">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2
                          className="animate-spin text-black/40 dark:text-white/40"
                          size={24}
                        />
                      </div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="text-center py-16 px-4 text-black/60 dark:text-white/60 text-sm">
                        {searchQuery
                          ? 'No models found'
                          : 'No chat models configured'}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {favoriteModels.length > 0 && (
                          <div>
                            <div className="sticky top-[var(--model-search-offset,0px)] z-10 border-b border-light-200/50 bg-light-primary px-4 py-2.5 dark:border-dark-200/50 dark:bg-dark-primary">
                              <p className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
                                Favorites
                              </p>
                            </div>
                            <div className="flex flex-col space-y-0.5 px-2 py-2">
                              {favoriteModels.map(({ provider, model }) =>
                                renderModelRow(
                                  provider.id,
                                  provider.name,
                                  model,
                                  true,
                                ),
                              )}
                            </div>
                            <div className="h-px bg-light-200 dark:bg-dark-200" />
                          </div>
                        )}
                        {filteredProviders.map((provider, providerIndex) => (
                          <div key={provider.id}>
                            <div className="sticky top-[var(--model-search-offset,0px)] z-10 border-b border-light-200/50 bg-light-primary px-4 py-2.5 dark:border-dark-200/50 dark:bg-dark-primary">
                              <p className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
                                {provider.name}
                              </p>
                            </div>

                            <div className="flex flex-col space-y-0.5 px-2 py-2">
                              {provider.chatModels.map((model) =>
                                renderModelRow(
                                  provider.id,
                                  provider.name,
                                  model,
                                ),
                              )}
                            </div>

                            {providerIndex < filteredProviders.length - 1 && (
                              <div className="h-px bg-light-200 dark:bg-dark-200" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default ModelSelector;
