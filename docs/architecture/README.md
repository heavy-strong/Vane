# Vane Architecture

Vane is a Next.js application that combines an AI chat experience with search.

For a high level flow, see [WORKING.md](WORKING.md). For deeper implementation details, see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Key components

1. **User Interface**

   - A web based UI that lets users chat, search, and view citations.

2. **API Routes**

   - `POST /api/chat` powers the chat UI.
   - `POST /api/search` provides a programmatic search endpoint.
   - `GET /api/providers` lists available providers and model keys.

3. **Agents and Orchestration**

   - The system classifies the question first.
   - It can run research and widgets in parallel.
   - It generates the final answer and includes citations.

4. **Search Backend**

   - A meta search backend is used to fetch relevant web results when research is enabled.

5. **LLMs (Large Language Models)**

   - Used for classification, writing answers, and producing citations.

6. **Embedding Models**

   - Used for semantic search over user uploaded files.

7. **Storage**
   - Chats and messages are stored so conversations can be reloaded.

8. **Shared client preferences** (`src/lib/preferences/`)
   - Settings chosen in the UI (theme, measurement unit, widgets, system instructions, selected chat/embedding model, reasoning options, favorite models) live on the server in `data/preferences.json`, so every client of the same server — browsers, Vane Desktop, embedded webviews — shows the same settings.
   - Each client keeps a localStorage copy for synchronous reads. Writes go through `setPreference`/`removePreference`, which update the copy and `PATCH /api/preferences`. Changes from other clients arrive over `GET /api/preferences/events` (server-sent events) and are written into the copy.
   - `PreferencesSync` holds rendering until the shared values are loaded (at most 3 s, then it uses the local copy), so components never start from a stale copy and write it back.
   - The first time a client syncs, it adds its existing settings for keys the server does not have yet and joins its favorite models with the server's; the server's values win otherwise.
   - Window-local state stays per client: sidebar expansion and the New question shortcut (global in Vane Desktop).
   - The synced keys are listed in `src/lib/preferences/keys.ts`; a new client-scoped setting must be added there to sync.
