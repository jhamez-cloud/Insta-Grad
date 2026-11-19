import type {
  DocumentDetail,
  DocumentList,
  DocumentListOptions,
  DocumentOut,
  HealthOut,
  LibraryList,
  LibraryOut,
  PaginationOptions,
  QueryRequest,
  QueryResponse,
  ServiceInfo,
  SessionList,
  SessionOut,
  UploadOptions,
  UploadConfiguration,
  UploadResponse,
} from "@/lib/api-contracts"
import type {
  CreateLibraryInput,
  Library,
  QueryFailureKind,
  UploadItem,
} from "@/lib/types"
import { documentMediaType } from "@/lib/document-formats"

export type * from "@/lib/api-contracts"

const API_BASE = "/api/policy"
const LIBRARY_EVENT = "instagrad:libraries-changed"

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
    public readonly kind?: QueryFailureKind
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const issues = detail.flatMap((issue) => {
      if (!issue || typeof issue !== "object") return []
      const item = issue as { loc?: unknown[]; msg?: unknown }
      if (typeof item.msg !== "string") return []
      const field = item.loc?.filter((part) => part !== "body").join(".")
      return [field ? `${field}: ${item.msg}` : item.msg]
    })
    return issues.join("; ")
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return typeof detail.message === "string" ? detail.message : ""
  }
  return ""
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error
    if (error instanceof Error && error.name === "TimeoutError")
      throw new ApiError(
        "The policy request timed out. Please try again.",
        408,
        undefined,
        "timeout"
      )
    throw new ApiError(
      "Could not reach the policy service. Check that both local projects are running.",
      0,
      undefined,
      "unavailable"
    )
  }
  if (response.status === 204) return undefined as T
  let content: string
  try {
    content = await response.text()
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      "The answer connection was interrupted before the response could load. Please try again.",
      response.status,
      undefined,
      "response_failed"
    )
  }
  let payload: unknown
  try {
    payload = content ? JSON.parse(content) : null
  } catch {
    throw new ApiError(
      "The policy service returned an invalid response.",
      response.status,
      undefined,
      "response_failed"
    )
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? payload.detail
        : payload
    throw new ApiError(
      errorMessage(detail) || `The request failed (${response.status}).`,
      response.status,
      detail
    )
  }
  return payload as T
}

function positiveId(value: string | number): string {
  const id = String(value)
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new ApiError("Choose a valid document, library, or session.", 422)
  }
  return id
}

function parameters(
  values: Record<string, string | number | boolean | undefined>
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `?${search}` : ""
}

function pagination(options: PaginationOptions) {
  const limit = options.limit ?? 20
  const offset = options.offset ?? 0
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    throw new ApiError(
      "Use a page size from 1 to 100 and a nonnegative offset.",
      422
    )
  }
  return { limit, offset }
}

async function collectPages<T>(
  load: (options: PaginationOptions) => Promise<{ total: number; items: T[] }>,
  signal?: AbortSignal
): Promise<T[]> {
  const items: T[] = []
  let offset = 0
  while (true) {
    const page = await load({ limit: 100, offset, signal })
    items.push(...page.items)
    offset += page.items.length
    if (offset >= page.total || page.items.length === 0) return items
  }
}

function emitLibraryChange() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(LIBRARY_EVENT))
}

export function getServiceInfo(signal?: AbortSignal): Promise<ServiceInfo> {
  return request("root", { signal })
}

export function getHealth(signal?: AbortSignal): Promise<HealthOut> {
  return request("health", { signal })
}

export function getOpenApi(
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  return request("openapi.json", { signal })
}

export function listLibraryRecords(
  options: PaginationOptions = {}
): Promise<LibraryList> {
  return request(`libraries${parameters(pagination(options))}`, {
    signal: options.signal,
  })
}

export function listDocuments(
  options: DocumentListOptions = {}
): Promise<DocumentList> {
  if (options.libraryId !== undefined && options.uncategorized) {
    throw new ApiError(
      "Choose either a library or uncategorized documents.",
      422
    )
  }
  return request(
    `documents${parameters({
      ...pagination(options),
      category: options.category,
      library_id:
        options.libraryId === undefined
          ? undefined
          : positiveId(options.libraryId),
      uncategorized: options.uncategorized,
    })}`,
    { signal: options.signal }
  )
}

export function listAllDocuments(
  options: Omit<DocumentListOptions, "limit" | "offset"> = {}
): Promise<DocumentOut[]> {
  return collectPages(
    (page) => listDocuments({ ...options, ...page }),
    options.signal
  )
}

export function listLibraryDocuments(
  libraryId: string | number,
  options: PaginationOptions & { category?: string } = {}
): Promise<DocumentList> {
  return request(
    `libraries/${positiveId(libraryId)}/documents${parameters({
      ...pagination(options),
      category: options.category,
    })}`,
    { signal: options.signal }
  )
}

export function listAllLibraryDocuments(
  libraryId: string | number,
  options: { category?: string; signal?: AbortSignal } = {}
): Promise<DocumentOut[]> {
  return collectPages(
    (page) => listLibraryDocuments(libraryId, { ...options, ...page }),
    options.signal
  )
}

export function getDocument(
  id: string | number,
  signal?: AbortSignal
): Promise<DocumentDetail> {
  return request(`documents/${positiveId(id)}`, { signal })
}

export async function deleteDocument(
  id: string | number,
  signal?: AbortSignal
): Promise<void> {
  await request<void>(`documents/${positiveId(id)}`, {
    method: "DELETE",
    signal,
  })
  emitLibraryChange()
}

export async function getUploadConfiguration(
  signal?: AbortSignal
): Promise<UploadConfiguration> {
  return request<UploadConfiguration>("documents/upload-options", { signal })
}

export async function uploadDocuments(
  files: File[],
  options: UploadOptions = {}
): Promise<UploadResponse> {
  if (!files.length)
    throw new ApiError("Choose at least one file to upload.", 422)
  const category = options.category?.trim().toLowerCase() || "general"
  if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(category)) {
    throw new ApiError(
      "Category must use 1–50 lowercase letters, digits, hyphens, or underscores.",
      422
    )
  }
  const form = new FormData()
  for (const file of files) form.append("files", file, file.name)
  form.append("category", category)
  if (options.libraryId !== undefined)
    form.append("library_id", positiveId(options.libraryId))
  const result = await request<UploadResponse>("documents/upload", {
    method: "POST",
    body: form,
    signal: options.signal,
  })
  if (result.indexed > 0) emitLibraryChange()
  return result
}

export async function assignLibraryDocuments(
  libraryId: string | number,
  documentIds: number[],
  signal?: AbortSignal
): Promise<DocumentList> {
  const result = await request<DocumentList>(
    `libraries/${positiveId(libraryId)}/documents`,
    {
      method: "POST",
      body: JSON.stringify({ document_ids: documentIds }),
      signal,
    }
  )
  emitLibraryChange()
  return result
}

export async function removeLibraryDocuments(
  libraryId: string | number,
  documentIds: number[],
  signal?: AbortSignal
): Promise<DocumentList> {
  const result = await request<DocumentList>(
    `libraries/${positiveId(libraryId)}/documents`,
    {
      method: "DELETE",
      body: JSON.stringify({ document_ids: documentIds }),
      signal,
    }
  )
  emitLibraryChange()
  return result
}

export async function removeLibraryDocument(
  libraryId: string | number,
  id: string | number,
  signal?: AbortSignal
): Promise<void> {
  await request<void>(
    `libraries/${positiveId(libraryId)}/documents/${positiveId(id)}`,
    {
      method: "DELETE",
      signal,
    }
  )
  emitLibraryChange()
}

export function documentToUploadItem(document: DocumentOut): UploadItem {
  return {
    id: String(document.id),
    documentId: document.id,
    name: document.filename,
    path: document.filename,
    size: 0,
    sizeKnown: false,
    type: documentMediaType(document.filename),
    progress: 100,
    status: "complete",
    category: document.category,
    chunkCount: document.chunk_count,
    source: document.source,
  }
}

function mapLibrary(record: LibraryOut, documents: DocumentOut[]): Library {
  return {
    id: String(record.id),
    name: record.name,
    isSystem: record.is_system,
    description: record.is_system
      ? "Built-in software policies maintained by the project. Available in every workspace and included in each query."
      : undefined,
    createdAt: record.created_at,
    // The server exposes creation time only, so do not invent a modification time.
    updatedAt: record.created_at,
    files: documents.map(documentToUploadItem),
    fileCount: documents.length,
  }
}

export async function listLibraries(signal?: AbortSignal): Promise<Library[]> {
  const [records, documents] = await Promise.all([
    collectPages(listLibraryRecords, signal),
    listAllDocuments({ signal }),
  ])
  const byLibrary = new Map<number, DocumentOut[]>()
  for (const document of documents) {
    if (document.library_id === null) continue
    const group = byLibrary.get(document.library_id) ?? []
    group.push(document)
    byLibrary.set(document.library_id, group)
  }
  return records
    .map((record) => mapLibrary(record, byLibrary.get(record.id) ?? []))
    .sort((left, right) => Number(right.isSystem) - Number(left.isSystem))
}

export async function getLibrary(
  id: string | number,
  signal?: AbortSignal
): Promise<Library | null> {
  try {
    const record = await request<LibraryOut>(`libraries/${positiveId(id)}`, {
      signal,
    })
    const documents = await listAllLibraryDocuments(id, { signal })
    return mapLibrary(record, documents)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function createLibrary(
  input: CreateLibraryInput,
  signal?: AbortSignal
): Promise<Library> {
  const name = input.name.trim()
  if (!name || name.length > 255)
    throw new ApiError("Use 1–255 characters for the library name.", 422)
  if (input.description?.trim() || input.files.length) {
    throw new ApiError(
      "Create the library with a name, then upload files to its ID. Descriptions are not supported by the service.",
      422
    )
  }
  const record = await request<LibraryOut>("libraries", {
    method: "POST",
    body: JSON.stringify({ name }),
    signal,
  })
  emitLibraryChange()
  return mapLibrary(record, [])
}

export async function renameLibrary(
  id: string | number,
  name: string,
  signal?: AbortSignal
): Promise<Library> {
  const nextName = name.trim()
  if (!nextName || nextName.length > 255)
    throw new ApiError("Use 1–255 characters for the library name.", 422)
  const record = await request<LibraryOut>(`libraries/${positiveId(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name: nextName }),
    signal,
  })
  emitLibraryChange()
  const documents = await listAllLibraryDocuments(id, { signal })
  return mapLibrary(record, documents)
}

export async function deleteLibrary(
  id: string | number,
  signal?: AbortSignal
): Promise<void> {
  await request<void>(`libraries/${positiveId(id)}`, {
    method: "DELETE",
    signal,
  })
  emitLibraryChange()
}

export function subscribeToLibraries(callback: () => void) {
  window.addEventListener(LIBRARY_EVENT, callback)
  window.addEventListener("focus", callback)
  return () => {
    window.removeEventListener(LIBRARY_EVENT, callback)
    window.removeEventListener("focus", callback)
  }
}

export function listSessions(
  options: PaginationOptions = {}
): Promise<SessionList> {
  return request(`sessions${parameters(pagination(options))}`, {
    signal: options.signal,
  })
}

export function listAllSessions(signal?: AbortSignal): Promise<SessionOut[]> {
  return collectPages(listSessions, signal)
}

export function createSession(
  libraryId: string | number,
  signal?: AbortSignal
): Promise<SessionOut> {
  return request("sessions", {
    method: "POST",
    body: JSON.stringify({ library_id: Number(positiveId(libraryId)) }),
    signal,
  })
}

export function getSession(
  id: string | number,
  signal?: AbortSignal
): Promise<SessionOut> {
  return request(`sessions/${positiveId(id)}`, { signal })
}

export function selectSessionLibrary(
  id: string | number,
  libraryId: string | number,
  signal?: AbortSignal
): Promise<SessionOut> {
  return request(`sessions/${positiveId(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ library_id: Number(positiveId(libraryId)) }),
    signal,
  })
}

export function deleteSession(
  id: string | number,
  signal?: AbortSignal
): Promise<void> {
  return request(`sessions/${positiveId(id)}`, { method: "DELETE", signal })
}

export async function query(
  input: QueryRequest,
  signal?: AbortSignal
): Promise<QueryResponse> {
  const result = await request<unknown>("query", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  })
  if (!validQueryResponse(result))
    throw new ApiError(
      "The policy service returned an empty or invalid answer. Please try again.",
      200,
      undefined,
      "response_failed"
    )
  return result
}

function validQueryResponse(value: unknown): value is QueryResponse {
  if (!value || typeof value !== "object") return false
  const result = value as Record<string, unknown>
  const validId = (id: unknown) =>
    id === null ||
    (typeof id === "number" && Number.isSafeInteger(id) && id > 0)
  return (
    typeof result.answer === "string" &&
    result.answer.trim().length > 0 &&
    typeof result.model === "string" &&
    validId(result.session_id) &&
    validId(result.library_id) &&
    Array.isArray(result.sources) &&
    result.sources.every((value: unknown) => {
      if (!value || typeof value !== "object") return false
      const source = value as Record<string, unknown>
      return (
        typeof source.document_id === "number" &&
        Number.isSafeInteger(source.document_id) &&
        source.document_id > 0 &&
        typeof source.title === "string" &&
        typeof source.category === "string" &&
        typeof source.chunk_id === "string" &&
        typeof source.excerpt === "string" &&
        typeof source.source === "string" &&
        typeof source.similarity === "number" &&
        Number.isFinite(source.similarity)
      )
    })
  )
}
