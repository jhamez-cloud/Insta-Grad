export type UploadStatus = "queued" | "uploading" | "complete" | "error"

export interface UploadItem {
  id: string
  name: string
  path: string
  size: number
  type: string
  progress: number
  status: UploadStatus
}

export interface Library {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  files: UploadItem[]
  fileCount: number
}

export type MessageRole = "user" | "assistant"
export type MessageStatus = "streaming" | "complete" | "stopped" | "error"

export interface MessageSource {
  id: string
  fileName: string
  excerpt: string
}

export interface Message {
  id: string
  libraryId: string
  role: MessageRole
  content: string
  createdAt: string
  status: MessageStatus
  sources?: MessageSource[]
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
