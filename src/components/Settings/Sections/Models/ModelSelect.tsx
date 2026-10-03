import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useChat } from '@/lib/hooks/useChat';
import {
  FAVORITES_CHANGED_EVENT,
  FavoriteChatModel,
  isFavoriteChatModel,
  readFavoriteChatModels,
  toggleFavoriteChatModel,
} from '@/lib/models/favorites';
import { cn } from '@/lib/utils';
import { Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const SEARCHABLE_LIST_THRESHOLD = 12;

type ModelOption = {
  value: string;
  label: string;
  search: string;
  providerId: string;
  modelKey: string;
};

const ModelSelect = ({
  providers,
  type,
}: {
  providers: ConfigModelProvider[];
  type: 'chat' | 'embedding';
}) => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<FavoriteChatModel[]>([]);
  const {
    chatModelProvider,
    embeddingModelProvider,
    setChatModelProvider,
    setEmbeddingModelProvider,
  } = useChat();

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

  const options = useMemo<ModelOption[]>(
    () =>
      type === 'chat'
        ? providers.flatMap((provider) =>
            provider.chatModels
              .filter((model) => model.key !== 'error')
              .map((model) => ({
                value: `${provider.id}/${model.key}`,
                label: `${provider.name} - ${model.name}`,
                search:
                  `${provider.name} ${model.name} ${model.key}`.toLowerCase(),
                providerId: provider.id,
                modelKey: model.key,
              })),
          )
        : providers.flatMap((provider) =>
            provider.embeddingModels
              .filter((model) => model.key !== 'error')
              .map((model) => ({
                value: `${provider.id}/${model.key}`,
                label: `${provider.name} - ${model.name}`,
                search:
                  `${provider.name} ${model.name} ${model.key}`.toLowerCase(),
                providerId: provider.id,
                modelKey: model.key,
              })),
          ),
    [providers, type],
  );
  const selectedModel =
    type === 'chat'
      ? `${chatModelProvider.providerId}/${chatModelProvider.key}`
      : `${embeddingModelProvider.providerId}/${embeddingModelProvider.key}`;
  const displayedModel = options.some(
    (option) => option.value === selectedModel,
  )
    ? selectedModel
    : (options[0]?.value ?? '');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.search.includes(normalizedQuery))
    : options;
  const favoriteOptions =
    type === 'chat'
      ? filteredOptions.filter((option) =>
          isFavoriteChatModel(favorites, option.providerId, option.modelKey),
        )
      : [];
  const remainingOptions = filteredOptions.filter(
    (option) =>
      !favoriteOptions.some((favorite) => favorite.value === option.value),
  );
  const searchable = options.length > SEARCHABLE_LIST_THRESHOLD;

  const handleSave = async (newValue: string) => {
    setLoading(true);

    try {
      const providerId = newValue.split('/')[0];
      const modelKey = newValue.split('/').slice(1).join('/');

      if (type === 'chat') {
        localStorage.setItem('chatModelProviderId', providerId);
        localStorage.setItem('chatModelKey', modelKey);

        setChatModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      } else {
        localStorage.setItem('embeddingModelProviderId', providerId);
        localStorage.setItem('embeddingModelKey', modelKey);

        setEmbeddingModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const renderOption = (option: ModelOption) => {
    const selected = option.value === displayedModel;
    const favorited =
      type === 'chat' &&
      isFavoriteChatModel(favorites, option.providerId, option.modelKey);

    return (
      <div
        key={option.value}
        className={cn(
          'flex items-center rounded-md',
          selected
            ? 'bg-sky-500/15'
            : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
        )}
      >
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSave(option.value)}
          className={cn(
            'min-w-0 flex-1 px-3 py-2 text-left text-xs',
            selected
              ? 'font-medium text-sky-600 dark:text-sky-400'
              : 'text-black/75 dark:text-white/75',
          )}
        >
          <div className="truncate">{option.label}</div>
          <div className="mt-0.5 truncate text-[10px] opacity-60">
            {option.modelKey}
          </div>
        </button>
        {type === 'chat' && (
          <button
            type="button"
            aria-label={
              favorited
                ? `Remove ${option.label} from favorites`
                : `Favorite ${option.label}`
            }
            onClick={() =>
              toggleFavoriteChatModel(option.providerId, option.modelKey)
            }
            className="mr-1 shrink-0 rounded-md p-1.5 text-black/30 transition hover:text-amber-500 dark:text-white/30"
          >
            <Star
              size={13}
              className={cn(favorited && 'fill-amber-400 text-amber-400')}
            />
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            Select {type === 'chat' ? 'Chat Model' : 'Embedding Model'}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {type === 'chat'
              ? 'Choose which model to use for generating responses'
              : 'Choose which model to use for generating embeddings'}
          </p>
        </div>
        {searchable ? (
          <div className="flex flex-col gap-2">
            {displayedModel && (
              <p className="text-xs text-black/70 dark:text-white/70">
                Current:{' '}
                {options.find((option) => option.value === displayedModel)
                  ?.label ?? displayedModel}
              </p>
            )}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${type === 'chat' ? 'chat' : 'embedding'} models...`}
                className="w-full rounded-lg border border-light-200 bg-light-secondary py-2 pl-8 pr-3 text-xs text-black focus:outline-none dark:border-dark-200 dark:bg-dark-secondary dark:text-white"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-light-200 p-1 dark:border-dark-200">
              {favoriteOptions.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">
                    Favorites
                  </p>
                  {favoriteOptions.map(renderOption)}
                  <div className="my-1 h-px bg-light-200 dark:bg-dark-200" />
                </div>
              )}
              {remainingOptions.map(renderOption)}
              {!filteredOptions.length && (
                <p className="py-8 text-center text-xs text-black/50 dark:text-white/50">
                  No matching models found.
                </p>
              )}
            </div>
          </div>
        ) : (
          <Select
            value={displayedModel}
            onChange={(event) => handleSave(event.target.value)}
            options={options}
            className="!text-xs lg:!text-[13px]"
            loading={loading}
            disabled={loading}
          />
        )}
      </div>
    </section>
  );
};

export default ModelSelect;
