import { uploadDocuments } from "@/lib/api"
import type { DocumentOut } from "@/lib/types"
import { DOCUMENT_EXTENSIONS, supportsDocument } from "@/lib/document-formats"

export interface SelectedUpload {
  id: string
  file: File
  path: string
  status:
    "queued" | "uploading" | "indexed" | "duplicate" | "rejected" | "error"
  detail: string
  document?: DocumentOut | null
}

export const CATEGORY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/

export function addSelectedFiles(
  current: SelectedUpload[],
  selected: File[],
  extensions = DOCUMENT_EXTENSIONS
) {
  const items = [...current]
  const keys = new Set(
    current.map(({ file, path }) => `${path}:${file.size}:${file.lastModified}`)
  )
  const unsupported: string[] = []
  for (const file of selected) {
    if (!supportsDocument(file.name, extensions)) {
      unsupported.push(file.name)
      continue
    }
    const path = file.webkitRelativePath || file.name
    const key = `${path}:${file.size}:${file.lastModified}`
    if (keys.has(key)) continue
    keys.add(key)
    items.push({
      id: crypto.randomUUID(),
      file,
      path,
      status: "queued",
      detail: "",
    })
  }
  return { items, unsupported }
}

export function uploadStatusLabel(item: SelectedUpload, libraryId?: string) {
  if (item.status === "duplicate") {
    if (item.document?.source === "seed")
      return "Built-in policy · Already available"
    return libraryId && String(item.document?.library_id) === libraryId
      ? "Already in this library"
      : "Duplicate; existing document kept"
  }
  return {
    queued: "Selected",
    uploading: "Uploading and indexing…",
    indexed: "Indexed",
    rejected: "Rejected",
    error: "Could not confirm upload",
  }[item.status]
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed. Try again."
}

export async function uploadSelection(
  selection: SelectedUpload[],
  category: string,
  libraryId: string | undefined,
  onUpdate: (items: SelectedUpload[]) => void,
  signal: AbortSignal
) {
  let items = [...selection]
  // One file per request respects configurable batch limits and lets successful
  // files remain confirmed if a later file fails or the browser stops waiting.
  for (let index = 0; index < items.length; index += 1) {
    if (signal.aborted) break
    if (
      items[index].status === "indexed" ||
      items[index].status === "duplicate"
    )
      continue
    items = items.map((item, position) =>
      position === index ? { ...item, status: "uploading", detail: "" } : item
    )
    onUpdate(items)
    try {
      const response = await uploadDocuments([items[index].file], {
        category,
        libraryId,
        signal,
      })
      const result = response.results[0]
      if (!result)
        throw new Error("The service returned no result for this file.")
      const status: SelectedUpload["status"] =
        result.status === "indexed"
          ? "indexed"
          : result.status === "duplicate"
            ? "duplicate"
            : result.status === "rejected"
              ? "rejected"
              : "error"
      items = items.map((item, position) =>
        position === index
          ? {
              ...item,
              status,
              detail: result.detail,
              document: result.document,
            }
          : item
      )
    } catch (error) {
      items = items.map((item, position) =>
        position === index
          ? {
              ...item,
              status: "error",
              detail: signal.aborted
                ? "Stopped waiting. This file may still finish on the server; refresh documents before retrying."
                : errorMessage(error),
            }
          : item
      )
      onUpdate(items)
      if (signal.aborted) break
      // Leave the remaining files selected for an explicit retry when the
      // service is unavailable rather than repeating the same failed request.
      break
    }
    onUpdate(items)
  }
  return items
}
