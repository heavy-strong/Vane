export const getSuggestions = async (
  chatHistory: [string, string][],
  target?: { chatId: string; messageId: string },
): Promise<string[]> => {
  const chatModel = localStorage.getItem('chatModelKey');
  const chatModelProvider = localStorage.getItem('chatModelProviderId');

  try {
    const res = await fetch(`/api/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatHistory,
        chatModel: {
          providerId: chatModelProvider,
          key: chatModel,
        },
        chatId: target?.chatId,
        messageId: target?.messageId,
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { suggestions?: string[] };

    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (err) {
    console.error('An error occurred while getting suggestions:', err);
    return [];
  }
};

export const getApproxLocation = async () => {
  const res = await fetch('https://free.freeipapi.com/api/json', {
    method: 'GET',
  });

  const data = await res.json();

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.cityName,
  };
};
