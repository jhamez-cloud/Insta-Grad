export type UploadStatus = "queued" | "uploading" | "complete" | "error"

export interface UploadItem {
  id: string
  name: string
  path: string
  size: number
  type: string
  progress: number
  status: UploadStatus
  /** Retain the actual browser file until multipart upload completes. */
  file?: File
  documentId?: number
  category?: string
  chunkCount?: number
  source?: string
  /** The backend does not expose original file sizes. */
  sizeKnown?: boolean
}

export interface Library {
  id: string
  name: string
  isSystem: boolean
  description?: string
  createdAt: string
  updatedAt: string
  files: UploadItem[]
  fileCount: number
}

export type MessageRole = "user" | "assistant"
export type MessageStatus = "streaming" | "complete" | "stopped" | "error"

export type QueryFailureKind = "unavailable" | "timeout" | "response_failed"

export interface QueryFailure {
  kind: QueryFailureKind
  message: string
  status?: number
}

export interface MessageSource {
  id: string
  fileName: string
  excerpt: string
  documentId?: number
  chunkId?: string
  category?: string
  similarity?: number
  source?: string
}

export interface Message {
  id: string
  libraryId: string
  role: MessageRole
  content: string
  createdAt: string
  status: MessageStatus
  sources?: MessageSource[]
  sessionId?: number
  model?: string
  /** Failure of this user query, retained with its browser transcript. */
  failure?: QueryFailure
}

export type ThoughtStepStatus = "pending" | "active" | "complete"

export interface ThoughtStep {
  id: string
  label: string
  status: ThoughtStepStatus
}

export interface DecisionStep {
  id: string
  title: string
  summary: string
  evidence: string[]
  confidence: number
}

export type ChatStreamEvent =
  | { type: "thought"; step: ThoughtStep }
  | { type: "token"; value: string }
  | { type: "done"; message: Message }

export interface CreateLibraryInput {
  name: string
  description?: string
  files: UploadItem[]
}

export type * from "@/lib/api-contracts"
