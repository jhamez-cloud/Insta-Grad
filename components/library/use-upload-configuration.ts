"use client"

import * as React from "react"
import { getUploadConfiguration, type UploadConfiguration } from "@/lib/api"
import { DOCUMENT_EXTENSIONS, documentFileAccept } from "@/lib/document-formats"

export function useUploadConfiguration() {
  const [configuration, setConfiguration] =
    React.useState<UploadConfiguration | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    void getUploadConfiguration(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setConfiguration(value)
      })
      .catch(() => {
        // Files can still be selected while the service is unavailable.
        // Upload results report the authoritative validation and service errors.
      })
    return () => controller.abort()
  }, [])

  const extensions = configuration?.supported_extensions ?? DOCUMENT_EXTENSIONS
  return {
    extensions,
    fileAccept: documentFileAccept(extensions),
    limitLabel: configuration
      ? `Up to ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(configuration.max_upload_bytes / 1_000_000)} MB per file.`
      : "",
  }
}
