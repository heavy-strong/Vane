'use client';

import {
  Brain,
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  Search,
  Star,
} from 'lucide-react';
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
import { removePreference, setPreference } from '@/lib/preferences/client';
import { splitModelName } from '@/lib/models/display';

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
  max: 'Max',
};

const EFFORT_ORDER = Object.keys(EFFORT_LABELS) as ReasoningEffort[];

const formatEffort = (effort: ReasoningEffort) =>
  EFFORT_LABELS[effort] ?? effort;

const formatContextLength = (tokens?: number) => {
  if (!tokens || tokens <= 0) return undefined;
  if (tokens >= 1_000_000) return `${+(tokens / 1_000_000).toFixed(1)}M ctx`;
  return `${Math.round(tokens / 1000)}K ctx`;
};

const perMillion = (perToken?: string) => {
  const value = Number(perToken);
  if (!perToken || !Number.isFinite(value) || value < 0) return undefined;
  return value * 1_000_000;
};

const formatUsd = (value: number) =>
  `$${value < 1 ? +value.toFixed(3) : +value.toFixed(2)}`;

const formatPricing = (model: Model) => {
  const input = perMillion(model.pricing?.prompt);
  const output = perMillion(model.pricing?.completion);
  if (input === undefined || output === undefined) return undefined;
  return `${formatUsd(input)}/${formatUsd(output)}`;
};

const isFreeModel = (model: Model) =>
  perMillion(model.pricing?.prompt) === 0 &&
  perMillion(model.pricing?.completion) === 0;

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
            setPreference('chatModelProviderId', nextChat.providerId);
            setPreference('chatModelKey', nextChat.key);
          } else {
            removePreference('chatModelProviderId');
            removePreference('chatModelKey');
          }
          setChatThinkingEnabled(undefined);
          setChatReasoningEffort(undefined);
          removePreference('chatThinkingEnabled');
          removePreference('chatReasoningEffort');
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
            setPreference('embeddingModelProviderId', nextEmbedding.providerId);
            setPreference('embeddingModelKey', nextEmbedding.key);
          } else {
            removePreference('embeddingModelProviderId');
            removePreference('embeddingModelKey');
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
    setPreference('chatModelProviderId', providerId);
    setPreference('chatModelKey', modelKey);

    const model = providers
      .find((provider) => provider.id === providerId)
      ?.chatModels.find((candidate) => candidate.key === modelKey);
    if (
      chatReasoningEffort &&
      !model?.reasoning?.supportedEfforts?.includes(chatReasoningEffort)
    ) {
      setChatReasoningEffort(undefined);
      removePreference('chatReasoningEffort');
    }
    if (!model?.reasoning) {
      setChatThinkingEnabled(undefined);
      removePreference('chatThinkingEnabled');
    }
  };

  const selectedProvider = providers.find(
    (provider) => provider.id === chatModelProvider?.providerId,
  );
  const selectedModel = selectedProvider?.chatModels.find(
    (model) => model.key === chatModelProvider?.key,
  );
  const supportedEfforts = (selectedModel?.reasoning?.supportedEfforts ?? [])
    .filter((effort) => effort !== 'none')
    .sort((a, b) => EFFORT_ORDER.indexOf(a) - EFFORT_ORDER.indexOf(b));

  const handleEffortChange = (effort: string) => {
    const value = effort ? (effort as ReasoningEffort) : undefined;
    setChatReasoningEffort(value);
    if (value) setPreference('chatReasoningEffort', value);
    else removePreference('chatReasoningEffort');
  };

  const handleThinkingChange = (value: string) => {
    const enabled = value === '' ? undefined : value === 'on';
    setChatThinkingEnabled(enabled);
    if (enabled === undefined) removePreference('chatThinkingEnabled');
    else setPreference('chatThinkingEnabled', String(enabled));
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

  const selectedLabel = selectedModel
    ? splitModelName(selectedModel.name).label
    : undefined;
  const reasoning = selectedModel?.reasoning;
  const thinkingOff = chatThinkingEnabled === false;
  const effectiveEffort = chatReasoningEffort ?? reasoning?.defaultEffort;
  const effortButtonLabel = thinkingOff
    ? 'Off'
    : effectiveEffort
      ? formatEffort(effectiveEffort)
      : 'Auto';

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
    const { vendor, label } = splitModelName(model.name);
    const free = isFreeModel(model);
    const meta = [
      showProviderName ? providerName : undefined,
      vendor,
      formatContextLength(model.contextLength),
      free ? undefined : formatPricing(model),
    ].filter(Boolean);

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
          title={`${model.name}\n${providerName} · ${model.key}`}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3 pr-1 text-start"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'truncate text-[13px] leading-5',
                  selected
                    ? 'font-medium text-sky-600 dark:text-sky-400'
                    : 'text-black/85 dark:text-white/85',
                )}
              >
                {label}
              </span>
              {model.reasoning && (
                <Brain
                  size={12}
                  aria-label="Supports reasoning"
                  className="shrink-0 text-black/30 dark:text-white/30"
                />
              )}
              {free && (
                <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Free
                </span>
              )}
            </div>
            {meta.length > 0 && (
              <p className="truncate text-[11px] leading-4 text-black/40 dark:text-white/40">
                {meta.join(' · ')}
              </p>
            )}
          </div>
          {selected && <Check size={14} className="shrink-0 text-sky-500" />}
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
          className="mr-1 shrink-0 rounded-md p-1.5 text-black/20 transition hover:text-amber-500 dark:text-white/20"
        >
          <Star
            size={13}
            className={cn(favorited && 'fill-amber-400 text-amber-400')}
          />
        </button>
      </div>
    );
  };

  const renderSectionHeader = (title: string) => (
    <div className="sticky top-[var(--model-search-offset,0px)] z-10 bg-light-primary/95 px-4 pb-1 pt-2.5 backdrop-blur dark:bg-dark-primary/95">
      <p className="text-[10px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">
        {title}
      </p>
    </div>
  );

  const renderOptionRow = (
    key: string,
    label: string,
    active: boolean,
    onSelect: () => void,
    disabled = false,
  ) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-start text-xs transition disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'bg-light-secondary text-black dark:bg-dark-secondary dark:text-white'
          : 'text-black/70 hover:bg-light-secondary dark:text-white/70 dark:hover:bg-dark-secondary',
      )}
    >
      <span className="truncate">{label}</span>
      {active && <Check size={13} className="shrink-0 text-sky-500" />}
    </button>
  );

  return (
    <div className="flex min-w-0 shrink-0 items-center">
      <Popover className="relative min-w-0">
        {({ open }) => (
          <>
            <PopoverButton
              type="button"
              title={
                selectedModel
                  ? `${selectedModel.name} · ${selectedProvider?.name ?? ''}`
                  : undefined
              }
              className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 flex max-w-[8rem] items-center gap-1 rounded-lg p-2 text-black/50 transition duration-200 hover:text-black active:scale-95 focus:outline-none headless-open:text-black dark:text-white/50 dark:hover:text-white sm:max-w-[15rem]"
            >
              <Cpu size={16} className="shrink-0 text-sky-500" />
              <span className="truncate text-xs text-black/70 dark:text-white/70">
                {selectedLabel ?? 'Select model'}
              </span>
              <ChevronDown
                size={12}
                className="hidden shrink-0 sm:block text-black/40 dark:text-white/40"
              />
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
                  className="z-[60] w-[min(380px,calc(100vw-1.5rem))] rounded-xl border border-light-200 bg-light-primary shadow-lg outline-none [--anchor-max-height:min(70vh,520px)] dark:border-dark-200 dark:bg-dark-primary"
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
                          size={15}
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
                    </div>

                    <div className="overscroll-contain pb-1">
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
                              {renderSectionHeader('Favorites')}
                              <div className="flex flex-col gap-px px-1.5 pb-1.5">
                                {favoriteModels.map(({ provider, model }) =>
                                  renderModelRow(
                                    provider.id,
                                    provider.name,
                                    model,
                                    true,
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                          {filteredProviders.map((provider) => (
                            <div key={provider.id}>
                              {renderSectionHeader(provider.name)}
                              <div className="flex flex-col gap-px px-1.5 pb-1.5">
                                {provider.chatModels.map((model) =>
                                  renderModelRow(
                                    provider.id,
                                    provider.name,
                                    model,
                                  ),
                                )}
                              </div>
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

      {reasoning && (
        <Popover className="relative shrink-0">
          {({ open }) => (
            <>
              <PopoverButton
                type="button"
                title="Reasoning"
                className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 flex items-center gap-1 rounded-lg px-1.5 py-2 text-black/50 transition duration-200 hover:text-black active:scale-95 focus:outline-none headless-open:text-black dark:text-white/50 dark:hover:text-white"
              >
                <Brain
                  size={14}
                  className={cn(
                    'shrink-0',
                    thinkingOff
                      ? 'text-black/30 dark:text-white/30'
                      : 'text-violet-500',
                  )}
                />
                <span className="whitespace-nowrap text-xs text-black/60 dark:text-white/60">
                  {effortButtonLabel}
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
                    className="z-[60] w-52 rounded-xl border border-light-200 bg-light-primary p-1.5 shadow-lg outline-none dark:border-dark-200 dark:bg-dark-primary"
                    static
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.1, ease: 'easeOut' }}
                      className="flex flex-col gap-px"
                    >
                      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">
                        Thinking
                      </p>
                      {renderOptionRow(
                        'thinking-default',
                        'Default',
                        chatThinkingEnabled === undefined,
                        () => handleThinkingChange(''),
                      )}
                      {renderOptionRow(
                        'thinking-on',
                        'On',
                        chatThinkingEnabled === true,
                        () => handleThinkingChange('on'),
                      )}
                      {!reasoning.mandatory &&
                        renderOptionRow(
                          'thinking-off',
                          'Off',
                          thinkingOff,
                          () => handleThinkingChange('off'),
                        )}
                      <div className="mx-1 my-1 h-px bg-light-200 dark:bg-dark-200" />
                      <p className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">
                        Effort
                      </p>
                      {renderOptionRow(
                        'effort-default',
                        reasoning.defaultEffort
                          ? `Default (${formatEffort(reasoning.defaultEffort)})`
                          : 'Model default',
                        !chatReasoningEffort,
                        () => handleEffortChange(''),
                        thinkingOff,
                      )}
                      {supportedEfforts.map((effort) =>
                        renderOptionRow(
                          `effort-${effort}`,
                          formatEffort(effort),
                          chatReasoningEffort === effort,
                          () => handleEffortChange(effort),
                          thinkingOff,
                        ),
                      )}
                    </motion.div>
                  </PopoverPanel>
                )}
              </AnimatePresence>
            </>
          )}
        </Popover>
      )}
    </div>
  );
};

export default ModelSelector;
