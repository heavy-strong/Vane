import SessionManager from '@/lib/session';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const session = SessionManager.getSession(id);

    if (!session) {
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    session.abort();

    return Response.json({ message: 'Session stopped' }, { status: 200 });
  } catch (err) {
    console.error('Error in stopping session: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
