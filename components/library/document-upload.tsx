"use client"

import * as React from "react"
import { FilePlus2Icon, UploadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  addSelectedFiles,
  CATEGORY_PATTERN,
  FILE_ACCEPT,
  uploadSelection,
  uploadStatusLabel,
  type SelectedUpload,
} from "@/components/library/upload-helpers"

export function DocumentUpload({
  libraryId,
  onUploaded,
}: {
  libraryId?: string
  onUploaded: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const controllerRef = React.useRef<AbortController | null>(null)
  const [items, setItems] = React.useState<SelectedUpload[]>([])
  const [category, setCategory] = React.useState("general")
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState("")
  const categoryIsValid = CATEGORY_PATTERN.test(category.trim())
  const pending = items.some(
    (item) => item.status !== "indexed" && item.status !== "duplicate"
  )

  React.useEffect(() => () => controllerRef.current?.abort(), [])

  async function upload() {
    if (uploading || !categoryIsValid || !pending) return
    setUploading(true)
    setError("")
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      await uploadSelection(
        items,
        category.trim(),
        libraryId,
        setItems,
        controller.signal
      )
    } finally {
      setUploading(false)
      onUploaded()
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Add documents</CardTitle>
        <CardDescription>
          Upload UTF-8 .md, .markdown or .txt files
          {libraryId ? " into this library" : " as uncategorized documents"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field data-invalid={!categoryIsValid || undefined}>
            <FieldLabel htmlFor="document-upload-category">Category</FieldLabel>
            <Input
              id="document-upload-category"
              value={category}
              disabled={uploading}
              maxLength={50}
              onChange={(event) =>
                setCategory(event.target.value.toLowerCase())
              }
              aria-invalid={!categoryIsValid}
            />
            <FieldDescription>
              1–50 lowercase letters, digits, hyphens or underscores.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={uploading}
          onChange={(event) => {
            const result = addSelectedFiles(
              items,
              Array.from(event.target.files ?? [])
            )
            setItems(result.items)
            setError(
              result.unsupported.length
                ? "Only Markdown and text files are supported."
                : ""
            )
            event.target.value = ""
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <FilePlus2Icon data-icon="inline-start" />
            Choose files
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={uploading || !pending || !categoryIsValid}
            onClick={() => void upload()}
          >
            <UploadIcon data-icon="inline-start" />
            {uploading ? "Uploading and indexing…" : "Upload selected files"}
          </Button>
          {uploading ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => controllerRef.current?.abort()}
            >
              Stop waiting
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {items.length ? (
          <ul
            className="flex max-h-72 flex-col gap-3 overflow-y-auto"
            aria-live="polite"
          >
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm break-all">
                    {item.path}
                  </span>
                  <Badge
                    variant={
                      item.status === "rejected" || item.status === "error"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {uploadStatusLabel(item, libraryId)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={uploading}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((entry) => entry.id !== item.id)
                      )
                    }
                    aria-label={`Clear ${item.file.name} from upload results`}
                  >
                    Clear
                  </Button>
                </div>
                {item.detail ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
                {libraryId &&
                item.status === "duplicate" &&
                String(item.document?.library_id) !== libraryId ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Use “Add existing documents” to move document{" "}
                    {item.document?.id} into this library.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
