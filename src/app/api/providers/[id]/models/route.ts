import ModelRegistry from '@/lib/models/registry';
import { Model } from '@/lib/models/types';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const type = req.nextUrl.searchParams.get('type');
    if (type !== 'chat' && type !== 'embedding') {
      return Response.json(
        { message: 'A valid model type is required.' },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();
    const catalog = await registry.getProviderModelCatalog(id);
    return Response.json({ models: catalog[type] });
  } catch (err) {
    console.error(
      'An error occurred while fetching provider model catalog',
      err,
    );
    return Response.json(
      { message: 'Unable to fetch model catalog.' },
      { status: 500 },
    );
  }
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const body: Partial<Model> & { type: 'embedding' | 'chat' } =
      await req.json();

    if (
      !body.key ||
      !body.name ||
      (body.type !== 'chat' && body.type !== 'embedding')
    ) {
      return Response.json(
        {
          message: 'Key, name, and a valid model type must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    const model = await registry.addProviderModel(id, body.type, body);
    const provider = (await registry.getActiveProviders()).find(
      (candidate) => candidate.id === id,
    );

    return Response.json(
      {
        message: 'Model added successfully',
        model,
        provider,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while adding provider model', err);
    const message =
      err instanceof Error ? err.message : 'An error has occurred.';
    return Response.json(
      {
        message,
      },
      {
        status: message.startsWith('Model already exists') ? 409 : 500,
      },
    );
  }
};

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const body: { key: string; type: 'embedding' | 'chat' } = await req.json();

    if (!body.key || (body.type !== 'chat' && body.type !== 'embedding')) {
      return Response.json(
        {
          message: 'Key and a valid model type must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    await registry.removeProviderModel(id, body.type, body.key);
    const provider = (await registry.getActiveProviders()).find(
      (candidate) => candidate.id === id,
    );

    return Response.json(
      {
        message: 'Model deleted successfully',
        provider,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while deleting provider model', err);
    const message =
      err instanceof Error ? err.message : 'An error has occurred.';
    return Response.json(
      {
        message,
      },
      {
        status: message.startsWith('Model not found') ? 404 : 500,
      },
    );
  }
};
