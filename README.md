# InstaGrad frontend

Next.js 16.4, React 19, TypeScript, Tailwind 4 and shadcn/Radix provide the document workspace. The separate `policy_copilot_rag_service` FastAPI project owns persistence, ingestion, retrieval and Gemini generation. Neither project imports the other or shares a package manager.

## Run the two projects

In the backend repository, keep its existing `.env` database and Gemini credentials, set a nonempty `ADMIN_API_KEY`, and allow the local frontend origins:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Start the backend from its own repository root:

```bash
cd ../policy_copilot_rag_service
uv run uvicorn policy_copilot_rag_service.api.main:app --host 127.0.0.1 --port 8000 --reload
```

In this frontend repository, create `.env.local` using `.env.example`. `POLICY_ADMIN_API_KEY` must match the backend `ADMIN_API_KEY`. These settings are server-only; never prefix the key with `NEXT_PUBLIC_`.

```dotenv
POLICY_API_URL=http://127.0.0.1:8000
POLICY_ADMIN_API_KEY=your-backend-admin-key
POLICY_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open http://localhost:3000/dashboard. Restart the frontend after changing server environment variables. Database and LLM provider URLs remain their existing service settings; application origins stay local.

The current local frontend targets the policy backend on port 8002 through `.env.local`.

## Integrated behavior

- Dashboard and sidebar load actual libraries and documents and show backend health. The backend creates a built-in **Software policy** library containing all seeded project policies. It appears first and can be browsed and queried, while its name and documents remain read-only. Custom libraries support rename/delete and document management.
- Create a library and upload `.pdf`, `.docx`, `.doc`, `.pptx`, `.csv`, `.txt`, `.md` or `.markdown` files. The backend converts them to readable text for indexing; upload results distinguish indexed, duplicate and rejected files. Legacy `.doc` uses `antiword` with a LibreOffice fallback. Scanned documents need OCR first; password-protected files are rejected.
- Manage all documents at `/documents`, or a library at `/libraries/:id/documents`: list/filter, inspect content, upload, assign documents, remove membership and permanently delete a document.
- Document browsing and assignment show at most three documents per page. Category filtering uses a shadcn InputGroup; changing filters or removing the last item returns to a valid page.
- Chat at `/libraries/:id` sends a real JSON question through an explicit backend session. Answers show returned sources, excerpts, provenance and model. Category filters apply to uploaded documents; shared software policies are still searched. `top_k` is a per-corpus request limit capped by the backend configuration.
- Failed questions show a small red circular badge on the query bubble. Focus or tap it to see whether the service was unavailable, the request timed out, or the response could not load, and retry that question. Failure badges are saved with browser transcripts; manually stopped queries are unmarked.
- `/sessions` creates, lists, opens, switches libraries and deletes backend sessions. The backend persists the session's selected library. Conversation transcripts are saved only in this browser because no backend messages endpoint exists. Earlier questions are not sent to the model as conversation history.
- Chat uses a compact two-row session toolbar with shadcn Select, a new-session icon, Conversation/Evidence ToggleGroup and a Library options menu. Session management also uses shadcn Select controls with keyboard and touch operation.
- Removing a library preserves its documents as unassigned and clears its selection on existing sessions. Removing document membership preserves the document; permanent document deletion also removes its indexed chunks.

The backend exposes no course, authentication, model selection, reasoning-effort or token-streaming API. The integration uses the supported library/document/session structure and complete JSON answers.

## Architecture and contracts

Browser components call `lib/api.ts`, which maps strict backend DTOs in `lib/api-contracts.ts` into the UI types in `lib/types.ts`. Requests go through the local Next.js route `/api/policy/...`. The route forwards only allowlisted backend operations and checks mutation origins before adding the server-held key. It preserves multipart uploads, upstream errors and no-content responses. This is a local admin workspace; it does not implement user authentication or multi-user authorization.

See [the complete endpoint and integration map](docs/API_INTEGRATION.md) for request fields, response structures and the RAG flow. Local backend interactive docs are at http://127.0.0.1:8002/docs; its schema is at `/openapi.json`.

This workspace runs the policy backend on port **8002** because Flame RAG services occupy ports 8000 and 8001. `.env.local` points the frontend at `http://127.0.0.1:8002`; use `uv run uvicorn policy_copilot_rag_service.api.main:app --host 127.0.0.1 --port 8002` from the backend repository. Its local docs are at http://127.0.0.1:8002/docs.

Project UI conventions, fonts, packages and installed primitives are in [AGENTS.md](AGENTS.md).

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

The optional `scripts/verify-integration.mjs` browser check uses Playwright Core
and installed Chrome. Set `INTEGRATION_PLAYWRIGHT_MODULE` to a separately installed
module's `index.mjs` (or resolve `playwright-core` normally), and optionally set
`INTEGRATION_CHROME_PATH`. With both services running, execute:

```bash
node scripts/verify-integration.mjs
```

This creates and cleans up temporary records, tests the complete endpoint
surface through the proxy, uploads actual browser files, exercises sessions
and citations, and checks mobile navigation. It makes one real LLM query; its
deterministic browser response tests only rendering. No test package is added
to the application dependencies.

`node scripts/verify-workspace-smoke.mjs` checks wizard uploads, session URL
persistence, source navigation, mobile/dark theme, and library deletion. It uses
the same optional Playwright/Chrome settings and cleans up its test records.

`node scripts/verify-system-library.mjs` checks built-in membership and real API
mutation protections, read-only UI, and error badges with controlled unavailable,
timeout, network, invalid and empty responses. It also checks transcript reload,
retry, cancellation and mobile dark mode, and cleans up its temporary records.

`node scripts/verify-workspace-controls.mjs` checks three-document pagination,
final-page correction, assignment selection across pages, keyboard/touch
Select controls, the compact toolbar, session URL persistence and library
reassignment. It uses the same optional Playwright settings and cleans up
temporary libraries, documents and sessions.
