/** DTOs matching Policy Copilot's Pydantic schemas. Keep wire names intact. */
export interface QueryRequest {
  question: string
  top_k?: number | null
  category?: string | null
  session_id?: number | null
}

export interface SourceOut {
  document_id: number
  title: string
  category: string
  chunk_id: string
  similarity: number
  excerpt: string
  source: string
}

export interface QueryResponse {
  answer: string
  sources: SourceOut[]
  model: string
  session_id: number | null
  library_id: number | null
}

export interface DocumentOut {
  id: number
  title: string
  category: string
  filename: string
  source: string
  chunk_count: number
  created_at: string
  library_id: number | null
}

export interface DocumentDetail extends DocumentOut {
  /** Readable text extracted from the original file and used for indexing. */
  content: string
}

export interface DocumentList {
  total: number
  items: DocumentOut[]
}

export interface UploadFileResult {
  filename: string
  status: "indexed" | "duplicate" | "rejected" | (string & {})
  detail: string
  document: DocumentOut | null
}

export interface UploadResponse {
  indexed: number
  skipped: number
  results: UploadFileResult[]
}

export interface UploadConfiguration {
  supported_extensions: string[]
  max_upload_bytes: number
  max_files_per_upload: number
  max_extracted_chars: number
}

export interface LibraryCreate {
  name: string
}

export type LibraryRename = LibraryCreate

export interface LibraryOut {
  id: number
  name: string
  created_at: string
  is_system: boolean
}

export interface LibraryList {
  total: number
  items: LibraryOut[]
}

export interface LibraryDocumentsRequest {
  document_ids: number[]
}

export interface SessionCreate {
  library_id: number
}

export type SessionUpdate = SessionCreate

export interface SessionOut {
  id: number
  library_id: number | null
  created_at: string
}

export interface SessionList {
  total: number
  items: SessionOut[]
}

export interface HealthOut {
  status: string
  database: boolean
  documents: number
  indexed_chunks: number
}

export interface ServiceInfo {
  status: string
  message: string
}

export interface PaginationOptions {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export interface DocumentListOptions extends PaginationOptions {
  category?: string
  libraryId?: string | number
  uncategorized?: boolean
}

export interface UploadOptions {
  category?: string
  libraryId?: string | number
  signal?: AbortSignal
}
