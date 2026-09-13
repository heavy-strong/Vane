'use client';

import { Cpu, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MinimalProvider, ReasoningEffort } from '@/lib/models/types';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

const ModelSelector = ({ align = 'end' }: { align?: 'start' | 'end' }) => {
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    chatModelProviderRef.current = chatModelProvider;
    embeddingModelProviderRef.current = embeddingModelProvider;
  }, [chatModelProvider, embeddingModelProvider]);

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

  const filteredProviders = orderedProviders
    .map((provider) => ({
      ...provider,
      chatModels: provider.chatModels.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          provider.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((provider) => provider.chatModels.length > 0);

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
                className={cn(
                  'absolute bottom-full z-[60] mb-2 w-[230px] sm:w-[270px] md:w-[300px]',
                  align === 'start' ? 'left-0' : 'right-0',
                )}
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className="origin-top-right bg-light-primary dark:bg-dark-primary max-h-[300px] sm:max-w-none border rounded-lg border-light-200 dark:border-dark-200 w-full flex flex-col shadow-lg overflow-hidden"
                >
                  <div className="p-2 border-b border-light-200 dark:border-dark-200">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                      />
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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

                  <div className="max-h-[320px] overflow-y-auto">
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
                        {filteredProviders.map((provider, providerIndex) => (
                          <div key={provider.id}>
                            <div className="px-4 py-2.5 sticky top-0 bg-light-primary dark:bg-dark-primary border-b border-light-200/50 dark:border-dark-200/50">
                              <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wider">
                                {provider.name}
                              </p>
                            </div>

                            <div className="flex flex-col px-2 py-2 space-y-0.5">
                              {provider.chatModels.map((model) => (
                                <button
                                  key={model.key}
                                  onClick={() =>
                                    handleModelSelect(provider.id, model.key)
                                  }
                                  type="button"
                                  className={cn(
                                    'px-3 py-2 flex items-center justify-between text-start duration-200 cursor-pointer transition rounded-lg group',
                                    chatModelProvider?.providerId ===
                                      provider.id &&
                                      chatModelProvider?.key === model.key
                                      ? 'bg-light-secondary dark:bg-dark-secondary'
                                      : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                                  )}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                    <Cpu
                                      size={15}
                                      className={cn(
                                        'shrink-0',
                                        chatModelProvider?.providerId ===
                                          provider.id &&
                                          chatModelProvider?.key === model.key
                                          ? 'text-sky-500'
                                          : 'text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70',
                                      )}
                                    />
                                    <p
                                      className={cn(
                                        'text-xs truncate',
                                        chatModelProvider?.providerId ===
                                          provider.id &&
                                          chatModelProvider?.key === model.key
                                          ? 'text-sky-500 font-medium'
                                          : 'text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white',
                                      )}
                                    >
                                      {model.name}
                                    </p>
                                  </div>
                                </button>
                              ))}
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
