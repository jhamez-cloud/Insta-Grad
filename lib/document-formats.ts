/** Fallback picker metadata; the backend upload-options endpoint is authoritative. */
const DOCUMENT_MEDIA_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
}

export const DOCUMENT_EXTENSIONS = Object.keys(DOCUMENT_MEDIA_TYPES)
export const DOCUMENT_FORMAT_LABEL =
  "PDF, Word, PowerPoint, CSV, text and Markdown"

export function documentMediaType(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase()
  return DOCUMENT_MEDIA_TYPES[extension] || "application/octet-stream"
}

export function documentFileAccept(extensions = DOCUMENT_EXTENSIONS): string {
  return [
    ...new Set([...extensions, ...extensions.map(documentMediaType)]),
  ].join(",")
}

export function supportsDocument(
  filename: string,
  extensions = DOCUMENT_EXTENSIONS
): boolean {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase()
  return extensions.includes(extension)
}
