/** Run with node scripts/verify-chat-contracts.mjs; no service or browser needed. */
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import ts from "typescript"

async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  )
}

const api = await loadTypeScript("../lib/api.ts")
const transcripts = await loadTypeScript(
  "../components/chat/chat-transcript.ts"
)
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const input = { question: "What does this policy cover?", session_id: 12 }
const valid = {
  answer: "The policy covers document uploads.",
  model: "test-model",
  session_id: 12,
  library_id: 3,
  sources: [
    {
      document_id: 4,
      title: "Upload policy",
      category: "general",
      chunk_id: "4-0",
      similarity: 0.9,
      excerpt: "Upload requirements",
      source: "seed",
    },
  ],
}

await test("chat response contract and transport failures", async (suite) => {
  try {
    await suite.test(
      "accepts a complete answer and valid citations",
      async () => {
        globalThis.fetch = async () => Response.json(valid)
        assert.deepEqual(await api.query(input), valid)
      }
    )
    await suite.test(
      "rejects empty, missing, or malformed answers and citations",
      async () => {
        for (const payload of [
          null,
          {},
          { ...valid, answer: " " },
          { ...valid, sources: null },
          { ...valid, sources: [{ ...valid.sources[0], document_id: -1 }] },
          { ...valid, session_id: "12" },
        ]) {
          globalThis.fetch = async () => Response.json(payload)
          await assert.rejects(
            api.query(input),
            (error) =>
              error instanceof api.ApiError && error.kind === "response_failed"
          )
        }
        globalThis.fetch = async () => new Response("broken JSON")
        await assert.rejects(
          api.query(input),
          (error) => error.kind === "response_failed"
        )
      }
    )
    await suite.test(
      "retains HTTP service and timeout status codes",
      async () => {
        for (const status of [503, 504, 408]) {
          globalThis.fetch = async () =>
            Response.json({ detail: "Service request failed" }, { status })
          await assert.rejects(
            api.query(input),
            (error) => error instanceof api.ApiError && error.status === status
          )
        }
      }
    )
    await suite.test(
      "distinguishes offline and browser timeout errors",
      async () => {
        globalThis.fetch = async () => {
          throw new TypeError("Failed to fetch")
        }
        await assert.rejects(
          api.query(input),
          (error) => error.status === 0 && error.kind === "unavailable"
        )
        globalThis.fetch = async () => {
          throw new DOMException("Timed out", "TimeoutError")
        }
        await assert.rejects(
          api.query(input),
          (error) => error.kind === "timeout"
        )
      }
    )
    await suite.test(
      "handles a response body that cannot finish loading",
      async () => {
        globalThis.fetch = async () => ({
          status: 200,
          ok: true,
          text: async () => {
            throw new TypeError("Connection interrupted")
          },
        })
        await assert.rejects(
          api.query(input),
          (error) => error.kind === "response_failed"
        )
      }
    )
    await suite.test(
      "preserves explicit cancellation without converting it to a failure",
      async () => {
        const controller = new AbortController()
        const canceled = new DOMException("Canceled", "AbortError")
        globalThis.fetch = async () => {
          controller.abort()
          throw canceled
        }
        await assert.rejects(
          api.query(input, controller.signal),
          (error) => error === canceled
        )
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

await test("browser transcript failure persistence", async (suite) => {
  const storage = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  }
  const question = {
    id: "query-1",
    libraryId: "3",
    sessionId: 12,
    role: "user",
    content: input.question,
    createdAt: "2026-11-11T12:00:00Z",
    status: "complete",
  }
  try {
    await suite.test(
      "restores failed queries alongside older unaffected messages",
      () => {
        const messages = [
          question,
          ...["unavailable", "timeout", "response_failed"].map(
            (kind, index) => ({
              ...question,
              id: `failed-${index}`,
              failure: {
                kind,
                message: "Please retry this query.",
                status: 503,
              },
            })
          ),
        ]
        assert.equal(transcripts.saveTranscript(12, messages), true)
        assert.deepEqual(transcripts.readTranscript(12, "3"), messages)
        assert.deepEqual(transcripts.readTranscript(12, "9"), [])
      }
    )
    await suite.test(
      "rejects corrupt failure metadata and assistant failure badges",
      () => {
        const messages = [
          question,
          ...[
            { kind: "invented", message: "failed" },
            { kind: "timeout", message: "" },
            { kind: "timeout", message: "failed", status: "504" },
          ].map((failure, index) => ({
            ...question,
            id: `invalid-${index}`,
            failure,
          })),
          {
            ...question,
            role: "assistant",
            failure: { kind: "timeout", message: "failed" },
          },
        ]
        transcripts.saveTranscript(12, messages)
        assert.deepEqual(transcripts.readTranscript(12, "3"), [question])
      }
    )
    await suite.test(
      "removing retry metadata stays removed after reload",
      () => {
        transcripts.saveTranscript(12, [{ ...question, failure: undefined }])
        assert.deepEqual(transcripts.readTranscript(12, "3"), [question])
      }
    )
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
