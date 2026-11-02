import type {
  ChatStreamEvent,
  CreateLibraryInput,
  Library,
  Message,
  MessageSource,
  ThoughtStep,
  UploadItem,
} from "@/lib/types"

const LIBRARIES_KEY = "instagrad:libraries:v1"
const MESSAGES_KEY = "instagrad:messages:v1"
const LIBRARY_EVENT = "instagrad:libraries-changed"

const seedFiles: UploadItem[] = [
  {
    id: "file-market",
    name: "Market landscape.pdf",
    path: "Research/Market landscape.pdf",
    size: 4_820_000,
    type: "application/pdf",
    progress: 100,
    status: "complete",
  },
  {
    id: "file-interviews",
    name: "Customer interviews.docx",
    path: "Research/Customer interviews.docx",
    size: 1_240_000,
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    progress: 100,
    status: "complete",
  },
  {
    id: "file-metrics",
    name: "Q3 metrics.xlsx",
    path: "Finance/Q3 metrics.xlsx",
    size: 780_000,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    progress: 100,
    status: "complete",
  },
]

const createdAt = new Date().toISOString()
const seedLibraries: Library[] = [
  {
    id: "product-research",
    name: "Product research",
    description: "Market notes, interviews, and quarterly evidence.",
    createdAt,
    updatedAt: createdAt,
    files: seedFiles,
    fileCount: seedFiles.length,
  },
  {
    id: "policy-review",
    name: "Policy review",
    description: "Contracts and policy changes prepared for review.",
    createdAt,
    updatedAt: createdAt,
    files: seedFiles.slice(0, 2).map((file, index) => ({
      ...file,
      id: `policy-${index}`,
    })),
    fileCount: 2,
  },
]

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback

  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function makeId(prefix: string) {
  const id =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${id}`
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"))
      return
    }

    const timer = globalThis.setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer)
        reject(new DOMException("Request aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

function getLibrariesSnapshot() {
  return readJson<Library[]>(LIBRARIES_KEY, seedLibraries)
}

function getMessagesSnapshot() {
  return readJson<Record<string, Message[]>>(MESSAGES_KEY, {})
}

export async function listLibraries(): Promise<Library[]> {
  await wait(260)
  return getLibrariesSnapshot().sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

export async function getLibrary(id: string): Promise<Library | null> {
  await wait(180)
  return getLibrariesSnapshot().find((library) => library.id === id) ?? null
}

export async function createLibrary(
  input: CreateLibraryInput
): Promise<Library> {
  await wait(520)
  const timestamp = new Date().toISOString()
  const library: Library = {
    id: makeId("library"),
    name: input.name.trim(),
    description: input.description?.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    files: input.files.map((file) => ({
      ...file,
      progress: 100,
      status: "complete",
    })),
    fileCount: input.files.length,
  }
  writeJson(LIBRARIES_KEY, [library, ...getLibrariesSnapshot()])
  window.dispatchEvent(new Event(LIBRARY_EVENT))
  return library
}

export async function renameLibrary(
  id: string,
  name: string
): Promise<Library> {
  const nextName = name.trim()
  if (nextName.length < 2)
    throw new Error("Use at least 2 characters for the library name.")

  await wait(260)
  const libraries = getLibrariesSnapshot()
  const current = libraries.find((library) => library.id === id)
  if (!current) throw new Error("This library could not be found.")
  if (current.name === nextName) return current

  const renamed = {
    ...current,
    name: nextName,
    updatedAt: new Date().toISOString(),
  }
  writeJson(
    LIBRARIES_KEY,
    libraries.map((library) => (library.id === id ? renamed : library))
  )
  window.dispatchEvent(new Event(LIBRARY_EVENT))
  return renamed
}

export async function deleteLibrary(id: string): Promise<void> {
  await wait(260)
  const libraries = getLibrariesSnapshot()
  if (!libraries.some((library) => library.id === id)) return

  const messages = getMessagesSnapshot()
  const previousLibraries = window.localStorage.getItem(LIBRARIES_KEY)
  try {
    writeJson(
      LIBRARIES_KEY,
      libraries.filter((library) => library.id !== id)
    )
    if (Object.hasOwn(messages, id)) {
      delete messages[id]
      writeJson(MESSAGES_KEY, messages)
    }
  } catch (error) {
    if (previousLibraries === null)
      window.localStorage.removeItem(LIBRARIES_KEY)
    else window.localStorage.setItem(LIBRARIES_KEY, previousLibraries)
    throw error
  }
  window.dispatchEvent(new Event(LIBRARY_EVENT))
}

export async function simulateUpload(
  files: UploadItem[],
  onProgress: (items: UploadItem[]) => void,
  signal?: AbortSignal
) {
  let items: UploadItem[] = files.map((file) => ({
    ...file,
    progress: 0,
    status: "uploading",
  }))
  onProgress(items)

  for (const progress of [14, 33, 57, 78, 100]) {
    await wait(220, signal)
    items = items.map((file, index) => ({
      ...file,
      progress:
        progress === 100
          ? 100
          : Math.min(99, Math.max(0, progress - index * 3)),
      status: progress === 100 ? "complete" : "uploading",
    }))
    onProgress(items)
  }

  return items
}

export async function listMessages(libraryId: string): Promise<Message[]> {
  await wait(180)
  return getMessagesSnapshot()[libraryId] ?? []
}

function persistMessage(message: Message) {
  if (
    !getLibrariesSnapshot().some((library) => library.id === message.libraryId)
  ) {
    throw new Error("Library not found")
  }
  const messages = getMessagesSnapshot()
  messages[message.libraryId] = [
    ...(messages[message.libraryId] ?? []),
    message,
  ]
  writeJson(MESSAGES_KEY, messages)
}

function sourceFor(library: Library): MessageSource[] {
  return library.files.slice(0, 3).map((file, index) => ({
    id: file.id,
    fileName: file.name,
    excerpt:
      index === 0
        ? "The strongest evidence clusters around adoption, cost, and implementation risk."
        : "This source reinforces the recommendation with a directly observed pattern.",
  }))
}

function answerFor(library: Library, prompt: string) {
  const subject = prompt
    .replace(/[?.!]+$/, "")
    .trim()
    .toLowerCase()
  return [
    `I reviewed ${library.fileCount} files in ${library.name}. `,
    `For “${subject},” the evidence points to a staged decision rather than a single yes-or-no answer. `,
    "The clearest pattern is strong near-term value when the rollout starts with the highest-confidence use case, ",
    "while cost and change-management risk rise quickly if the scope expands before the first results are measured. ",
    "I would run a bounded pilot, define a success threshold up front, and revisit the broader decision with the pilot evidence.",
  ].join("")
}

export async function* streamLibraryChat({
  libraryId,
  prompt,
  signal,
}: {
  libraryId: string
  prompt: string
  signal?: AbortSignal
}): AsyncGenerator<ChatStreamEvent> {
  const library = await getLibrary(libraryId)
  if (!library) throw new Error("Library not found")

  persistMessage({
    id: makeId("message"),
    libraryId,
    role: "user",
    content: prompt,
    createdAt: new Date().toISOString(),
    status: "complete",
  })

  const thoughtLabels = [
    "Mapping the question to library sources",
    "Comparing claims across documents",
    "Testing the strongest recommendation",
  ]

  for (let index = 0; index < thoughtLabels.length; index += 1) {
    await wait(420, signal)
    const step: ThoughtStep = {
      id: `thought-${index}`,
      label: thoughtLabels[index],
      status: index === thoughtLabels.length - 1 ? "active" : "complete",
    }
    yield { type: "thought", step }
  }

  const answer = answerFor(library, prompt)
  let streamed = ""
  const chunks = answer.match(/.{1,18}(?:\s|$)/g) ?? [answer]

  for (const chunk of chunks) {
    await wait(55, signal)
    streamed += chunk
    yield { type: "token", value: chunk }
  }

  const message: Message = {
    id: makeId("message"),
    libraryId,
    role: "assistant",
    content: streamed,
    createdAt: new Date().toISOString(),
    status: "complete",
    sources: sourceFor(library),
  }
  persistMessage(message)
  yield { type: "done", message }
}

export function subscribeToLibraries(callback: () => void) {
  window.addEventListener(LIBRARY_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(LIBRARY_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}
