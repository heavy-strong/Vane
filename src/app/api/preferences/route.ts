import preferenceStore from '@/lib/preferences/store';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = async () => Response.json(preferenceStore.get());

/** Body: `{ values: { key: string | null } }`; null removes a preference. */
export const PATCH = async (req: NextRequest) => {
  try {
    const body = await req.json();
    if (
      !body?.values ||
      typeof body.values !== 'object' ||
      Array.isArray(body.values)
    ) {
      return Response.json({ message: 'values is required.' }, { status: 400 });
    }
    return Response.json(preferenceStore.patch(body.values));
  } catch (err: any) {
    return Response.json(
      { message: err?.message || 'Invalid preferences.' },
      { status: 400 },
    );
  }
};
