import type { Message, QueryFailure } from "@/lib/types"

const PREFIX = "instagrad:policy:session:"

function validFailure(value: unknown): value is QueryFailure {
  if (!value || typeof value !== "object") return false
  const failure = value as Record<string, unknown>
  return (
    (failure.kind === "unavailable" ||
      failure.kind === "timeout" ||
      failure.kind === "response_failed") &&
    typeof failure.message === "string" &&
    failure.message.trim().length > 0 &&
    (failure.status === undefined ||
      (typeof failure.status === "number" &&
        Number.isInteger(failure.status) &&
        failure.status >= 0 &&
        failure.status <= 599))
  )
}

export function readTranscript(
  sessionId: number,
  libraryId: string
): Message[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(`${PREFIX}${sessionId}`) ?? "[]"
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Message => {
      if (!item || typeof item !== "object") return false
      const message = item as Record<string, unknown>
      return (
        message.sessionId === sessionId &&
        message.libraryId === libraryId &&
        typeof message.id === "string" &&
        typeof message.content === "string" &&
        (message.model === undefined || typeof message.model === "string") &&
        (message.failure === undefined ||
          (message.role === "user" && validFailure(message.failure))) &&
        (message.role === "user" || message.role === "assistant") &&
        message.status === "complete" &&
        typeof message.createdAt === "string" &&
        Number.isFinite(Date.parse(message.createdAt)) &&
        (message.sources === undefined ||
          (Array.isArray(message.sources) &&
            message.sources.every(
              (source: unknown) =>
                source !== null &&
                typeof source === "object" &&
                typeof (source as Record<string, unknown>).id === "string" &&
                typeof (source as Record<string, unknown>).fileName ===
                  "string" &&
                typeof (source as Record<string, unknown>).excerpt ===
                  "string" &&
                typeof (source as Record<string, unknown>).documentId ===
                  "number" &&
                Number.isSafeInteger(
                  (source as Record<string, unknown>).documentId
                ) &&
                Number((source as Record<string, unknown>).documentId) > 0 &&
                typeof (source as Record<string, unknown>).chunkId ===
                  "string" &&
                typeof (source as Record<string, unknown>).category ===
                  "string" &&
                typeof (source as Record<string, unknown>).source ===
                  "string" &&
                typeof (source as Record<string, unknown>).similarity ===
                  "number" &&
                Number.isFinite((source as Record<string, unknown>).similarity)
            )))
      )
    })
  } catch {
    return []
  }
}

export function saveTranscript(
  sessionId: number,
  messages: Message[]
): boolean {
  try {
    window.localStorage.setItem(
      `${PREFIX}${sessionId}`,
      JSON.stringify(messages)
    )
    return true
  } catch {
    return false
  }
}

export function clearTranscript(sessionId: number) {
  try {
    window.localStorage.removeItem(`${PREFIX}${sessionId}`)
  } catch {
    // Deleting a backend session must succeed even when browser storage is blocked.
  }
}
