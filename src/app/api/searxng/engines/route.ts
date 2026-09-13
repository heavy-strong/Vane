import { getSearxngEngines } from '@/lib/searxng';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Lists engines available on the configured SearXNG instance, optionally
 * filtered by category (`?category=images`). Used by the engine picker in
 * the settings UI. */
export const GET = async (req: NextRequest) => {
  try {
    const category = req.nextUrl.searchParams.get('category');

    const engines = (await getSearxngEngines())
      .filter((e) => !category || e.categories.includes(category))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ engines }, { status: 200 });
  } catch (err) {
    console.error('Error fetching SearXNG engines:', err);
    return Response.json(
      {
        message:
          err instanceof Error
            ? err.message
            : 'Failed to fetch SearXNG engines',
      },
      { status: 500 },
    );
  }
};
