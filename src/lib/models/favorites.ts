export type FavoriteChatModel = {
  providerId: string;
  key: string;
};

const STORAGE_KEY = 'favoriteChatModels';
export const FAVORITES_CHANGED_EVENT = 'favorite-chat-models-changed';

const isFavorite = (value: unknown): value is FavoriteChatModel =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as FavoriteChatModel).providerId === 'string' &&
  typeof (value as FavoriteChatModel).key === 'string';

export const readFavoriteChatModels = (): FavoriteChatModel[] => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isFavorite) : [];
  } catch {
    return [];
  }
};

export const writeFavoriteChatModels = (favorites: FavoriteChatModel[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
};

export const isFavoriteChatModel = (
  favorites: FavoriteChatModel[],
  providerId: string,
  key: string,
) =>
  favorites.some(
    (favorite) => favorite.providerId === providerId && favorite.key === key,
  );

export const toggleFavoriteChatModel = (
  providerId: string,
  key: string,
): FavoriteChatModel[] => {
  const current = readFavoriteChatModels();
  const exists = isFavoriteChatModel(current, providerId, key);
  const next = exists
    ? current.filter(
        (favorite) =>
          !(favorite.providerId === providerId && favorite.key === key),
      )
    : [...current, { providerId, key }];

  writeFavoriteChatModels(next);
  return next;
};
