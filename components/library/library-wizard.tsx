"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  CheckCircle2Icon,
  FileIcon,
  FolderUpIcon,
  UploadCloudIcon,
} from "lucide-react"

import { createLibrary } from "@/lib/api"
import {
  addSelectedFiles,
  CATEGORY_PATTERN,
  errorMessage,
  uploadSelection,
  uploadStatusLabel,
  type SelectedUpload,
} from "@/components/library/upload-helpers"
import { useUploadConfiguration } from "@/components/library/use-upload-configuration"
import { DOCUMENT_FORMAT_LABEL } from "@/lib/document-formats"
import type { Library } from "@/lib/types"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import Folder from "@/components/ui/Folder"
import { Input } from "@/components/ui/input"
import Stepper, { Step } from "@/components/ui/Stepper"

const MAX_FOLDER_ITEMS = 6

const stepperStyle = {
  "--stepper-frame": "var(--card)",
  "--stepper-frame-edge": "var(--border)",
  "--stepper-frame-highlight": "var(--card)",
  "--stepper-frame-shadow": "var(--shadow-panel)",
  "--stepper-tile": "var(--surface-subtle)",
  "--stepper-tile-edge": "var(--border)",
  "--stepper-tile-highlight": "var(--surface-raised)",
  "--stepper-tile-shadow": "none",
  "--stepper-well": "var(--muted)",
  "--stepper-track": "var(--border)",
  "--stepper-ink": "var(--foreground)",
  "--stepper-muted": "var(--muted-foreground)",
  "--stepper-faint": "var(--border)",
  "--stepper-ring": "var(--ring)",
  "--stepper-solid": "var(--primary)",
  "--stepper-solid-ink": "var(--primary-foreground)",
  "--stepper-hover": "brightness(1)",
  "--stepper-hover-fill": "var(--muted)",
  "--stepper-solid-hover": "brightness(.94)",
  "--stepper-press": "brightness(.88)",
} as React.CSSProperties

function formatBytes(value: number) {
  if (value < 1_000) return `${value} B`
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`
  return `${(value / 1_000_000).toFixed(1)} MB`
}

function folderEntries(files: SelectedUpload[]) {
  const visible = files.slice(
    0,
    files.length > MAX_FOLDER_ITEMS ? MAX_FOLDER_ITEMS - 1 : MAX_FOLDER_ITEMS
  )
  const entries = visible.map((item) => item.file.name)
  const remaining = files.length - visible.length

  if (remaining > 0) entries.push(`+${remaining} more`)
  return entries
}

export function LibraryWizard() {
  const { extensions, fileAccept, limitLabel } = useUploadConfiguration()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)
  const uploadControllerRef = React.useRef<AbortController | null>(null)
  const [step, setStep] = React.useState(1)
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState("general")
  const [files, setFiles] = React.useState<SelectedUpload[]>([])
  const [uploading, setUploading] = React.useState(false)
  const persistedLibraryRef = React.useRef<Library | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [createdLibrary, setCreatedLibrary] = React.useState<Library | null>(
    null
  )

  const theme = resolvedTheme === "dark" ? "dark" : "light"
  const nameIsValid = name.trim().length >= 1 && name.trim().length <= 255
  const categoryIsValid = CATEGORY_PATTERN.test(category.trim())
  const uploadsComplete = files.length > 0
  const [savedLibrary, setSavedLibrary] = React.useState<Library | null>(null)
  const libraryCreated = savedLibrary !== null

  React.useEffect(() => {
    return () => uploadControllerRef.current?.abort()
  }, [])

  React.useEffect(() => {
    if (!createdLibrary) return
    const timeout = globalThis.setTimeout(() => {
      router.push(`/libraries/${createdLibrary.id}`)
    }, 850)
    return () => globalThis.clearTimeout(timeout)
  }, [createdLibrary, router])

  const addFiles = (selected: File[]) => {
    if (saving || uploading) return
    const result = addSelectedFiles(files, selected, extensions)
    setFiles(result.items)
    setError(
      result.unsupported.length
        ? `Supported extensions: ${extensions.join(", ")}. Skipped: ${result.unsupported.slice(0, 3).join(", ")}.`
        : ""
    )
  }

  const handleInputFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    addFiles(Array.from(event.dataTransfer.files))
  }

  const removeFile = (id: string) => {
    if (uploading || saving) return
    setFiles((current) => current.filter((file) => file.id !== id))
  }

  const saveLibrary = async () => {
    if (!nameIsValid || !categoryIsValid || saving) return
    setSaving(true)
    setError("")
    const controller = new AbortController()
    uploadControllerRef.current = controller

    try {
      const library =
        persistedLibraryRef.current ??
        (await createLibrary({ name, files: [] }))
      persistedLibraryRef.current = library
      setSavedLibrary(library)
      setUploading(true)
      const results = await uploadSelection(
        files,
        category.trim(),
        library.id,
        setFiles,
        controller.signal
      )
      const needsAttention = results.some(
        (item) =>
          item.status !== "indexed" &&
          !(
            item.status === "duplicate" &&
            (String(item.document?.library_id) === library.id ||
              item.document?.source === "seed")
          )
      )
      if (controller.signal.aborted || needsAttention) {
        setError(
          "The library is saved. Review the file results below; retry unconfirmed files or open documents to add existing duplicates."
        )
      } else {
        setCreatedLibrary(library)
        setStep(5)
      }
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setUploading(false)
      setSaving(false)
    }
  }

  const nextDisabled =
    step === 1
      ? !nameIsValid
      : step === 2
        ? !categoryIsValid || uploading
        : step === 4
          ? saving || !nameIsValid || !categoryIsValid
          : false

  return (
    <main className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 py-8 font-sans sm:px-6 lg:px-10 lg:py-12">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm text-muted-foreground">Create a library</p>
        <h1 className="font-heading text-3xl leading-none font-medium text-balance sm:text-4xl">
          Give your documents a place to reason together.
        </h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Name the collection, add files or a folder, and review what InstaGrad
          will use as evidence.
        </p>
      </header>

      <Stepper
        step={step}
        onStepChange={(next) => {
          if (!saving) setStep(next)
        }}
        disableStepIndicators={saving || libraryCreated}
        backButtonProps={{ disabled: saving || libraryCreated }}
        linear
        indicator="numbers"
        transition="slide"
        width="100%"
        radius={18}
        theme={theme}
        accentColor="var(--primary)"
        style={stepperStyle}
        nextButtonText="Continue"
        completeButtonText={
          saving
            ? "Saving and indexing…"
            : libraryCreated
              ? "Retry unconfirmed files"
              : "Save library"
        }
        nextButtonProps={{
          disabled: nextDisabled,
          onClick: (event) => {
            if (step !== 4) return
            event.preventDefault()
            void saveLibrary()
          },
        }}
        completedContent={
          <div
            className="flex min-h-72 flex-col items-center justify-center gap-5 py-8 text-center"
            role="status"
          >
            <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle2Icon aria-hidden="true" />
            </span>
            <div className="flex max-w-md flex-col gap-2">
              <h2 className="font-heading text-2xl font-medium">
                Library ready
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {createdLibrary?.name ?? "Your library"} is saved. Opening its
                analysis workspace now.
              </p>
            </div>
            {createdLibrary ? (
              <Button
                onClick={() => router.push(`/libraries/${createdLibrary.id}`)}
              >
                Open library
              </Button>
            ) : null}
          </div>
        }
      >
        <Step title="Name" description="Identify this collection">
          <section className="flex min-h-80 flex-col justify-center gap-8 py-2">
            <div className="flex max-w-xl flex-col gap-2">
              <h2 className="font-heading text-2xl font-medium">
                What belongs together?
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Use a name you will recognize when you return to compare sources
                or continue a chat.
              </p>
            </div>
            <FieldGroup className="max-w-xl">
              <Field
                data-invalid={
                  name.length > 0 && !nameIsValid ? true : undefined
                }
              >
                <FieldLabel htmlFor="library-name">Library name</FieldLabel>
                <Input
                  id="library-name"
                  value={name}
                  maxLength={255}
                  disabled={libraryCreated}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Product research"
                  autoComplete="off"
                  aria-invalid={name.length > 0 && !nameIsValid}
                />
                <FieldDescription>Use 1–255 characters.</FieldDescription>
                {name.length > 0 && !nameIsValid ? (
                  <FieldError>
                    Enter a library name of 1–255 characters.
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </section>
        </Step>

        <Step title="Upload files/folders" description="Add the evidence">
          <section className="grid min-h-96 gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)] lg:items-center">
            <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface-subtle p-5 text-center sm:p-8">
              <Folder
                items={folderEntries(files)}
                label={name.trim() || "New library"}
                open={files.length > 0}
                peek={uploading}
                openOn="click"
                draggable={false}
                zoomOnClick={false}
                variant="matte"
                color="color-mix(in oklab, var(--chart-2) 42%, var(--card))"
                paperColor="oklch(0.975 0.004 95)"
                theme={theme}
                size={1.05}
              />
              <div className="flex flex-col gap-1" aria-live="polite">
                <p className="text-sm font-medium">
                  {uploading
                    ? `Indexing ${files.length} ${files.length === 1 ? "file" : "files"}`
                    : uploadsComplete
                      ? `${files.length} ${files.length === 1 ? "file" : "files"} ready`
                      : "Add the documents you want to analyze"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Documents are converted to readable text and indexed when you
                  save.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <FieldGroup>
                <Field data-invalid={!categoryIsValid || undefined}>
                  <FieldLabel htmlFor="upload-category">
                    Document category
                  </FieldLabel>
                  <Input
                    id="upload-category"
                    value={category}
                    maxLength={50}
                    onChange={(event) =>
                      setCategory(event.target.value.toLowerCase())
                    }
                    aria-invalid={!categoryIsValid}
                  />
                  <FieldDescription>
                    Use 1–50 lowercase letters, digits, hyphens or underscores.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <div
                className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-[var(--radius-panel)] border border-dashed border-border bg-surface p-5 text-center"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                role="region"
                aria-label="File upload drop area"
              >
                <UploadCloudIcon
                  className="size-7 text-primary"
                  aria-hidden="true"
                />
                <div className="flex max-w-sm flex-col gap-1">
                  <p className="text-sm font-medium">Drop files here</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Choose {DOCUMENT_FORMAT_LABEL} files. {limitLabel} Scanned
                    documents need OCR first.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || saving}
                  >
                    <FileIcon data-icon="inline-start" />
                    Choose files
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading || saving}
                  >
                    <FolderUpIcon data-icon="inline-start" />
                    Choose folder
                  </Button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept={fileAccept}
                multiple
                onChange={handleInputFiles}
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                ref={(input) => {
                  folderInputRef.current = input
                  input?.setAttribute("webkitdirectory", "")
                  input?.setAttribute("directory", "")
                }}
                className="sr-only"
                type="file"
                accept={fileAccept}
                multiple
                onChange={handleInputFiles}
                tabIndex={-1}
                aria-hidden="true"
              />

              {files.length > 0 ? (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Selected evidence</CardTitle>
                    <CardDescription>
                      {formatBytes(
                        files.reduce((total, item) => total + item.file.size, 0)
                      )}{" "}
                      total
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex max-h-52 flex-col gap-2 overflow-y-auto pe-1">
                      {files.map((file) => (
                        <li
                          key={file.id}
                          className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] bg-muted/60 px-3 py-2"
                        >
                          <FileIcon
                            className="size-4 flex-none text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {file.path}
                          </span>
                          <Badge
                            variant={
                              file.status === "error" ||
                              file.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {uploadStatusLabel(file, savedLibrary?.id)}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={uploading || saving}
                            onClick={() => removeFile(file.id)}
                            aria-label={`Remove ${file.file.name}`}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        </Step>

        <Step title="Review" description="Check names and sources">
          <section className="flex min-h-80 flex-col gap-6 py-2">
            <div className="flex max-w-xl flex-col gap-2">
              <h2 className="font-heading text-2xl font-medium">
                Review the evidence set
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                The service retrieves evidence from this library together with
                software policies and returns citations with each answer.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card size="sm" className="sm:col-span-2">
                <CardHeader>
                  <CardTitle>{name.trim()}</CardTitle>
                  <CardDescription>Category: {category.trim()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {files.slice(0, 6).map((file) => (
                      <li
                        key={file.id}
                        className="flex min-w-0 items-center gap-3 text-sm"
                      >
                        <CheckCircle2Icon
                          className="size-4 flex-none text-success"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {file.path}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatBytes(file.file.size)}
                        </span>
                      </li>
                    ))}
                    {files.length > 6 ? (
                      <li className="text-xs text-muted-foreground">
                        +{files.length - 6} more files
                      </li>
                    ) : null}
                  </ul>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Library size</CardTitle>
                  <CardDescription>Selected for indexing</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <strong className="font-heading text-4xl font-medium">
                    {files.length}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(
                      files.reduce((total, item) => total + item.file.size, 0)
                    )}
                  </span>
                </CardContent>
              </Card>
            </div>
          </section>
        </Step>

        <Step title="Save" description="Create the workspace">
          <section className="flex min-h-80 flex-col items-center justify-center gap-6 py-8 text-center">
            <span className="grid size-16 place-items-center rounded-[var(--radius-panel)] bg-signal-soft text-primary">
              <FolderUpIcon className="size-7" aria-hidden="true" />
            </span>
            <div className="flex max-w-lg flex-col gap-2">
              <h2 className="font-heading text-2xl font-medium">
                Create {name.trim()}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                This creates the library and indexes {files.length}{" "}
                {files.length === 1 ? "file" : "files"} and opens a new analysis
                workspace. You can add more evidence later.
              </p>
            </div>
            {saving ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => uploadControllerRef.current?.abort()}
              >
                Stop waiting for upload
              </Button>
            ) : null}
            {files.length > 0 ? (
              <ul
                className="flex w-full max-w-lg flex-col gap-3 text-start"
                aria-live="polite"
              >
                {files.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-sm break-all">
                        {item.path}
                      </span>
                      <Badge
                        variant={
                          item.status === "error" || item.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {uploadStatusLabel(item, savedLibrary?.id)}
                      </Badge>
                    </div>
                    {item.detail ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {libraryCreated && !saving ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(
                    `/libraries/${persistedLibraryRef.current!.id}/documents`
                  )
                }
              >
                Open library documents
              </Button>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </section>
        </Step>
      </Stepper>
    </main>
  )
}
