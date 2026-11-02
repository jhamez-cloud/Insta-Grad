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

import { createLibrary, simulateUpload } from "@/lib/api"
import type { Library, UploadItem } from "@/lib/types"
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
import { Progress } from "@/components/ui/progress"
import Stepper, { Step } from "@/components/ui/Stepper"
import { Textarea } from "@/components/ui/textarea"

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

function idForFile(file: File) {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `upload-${suffix}-${file.lastModified}`
}

function toUploadItem(file: File): UploadItem {
  return {
    id: idForFile(file),
    name: file.name,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    progress: 0,
    status: "queued",
  }
}

function formatBytes(value: number) {
  if (value < 1_000) return `${value} B`
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`
  return `${(value / 1_000_000).toFixed(1)} MB`
}

function folderEntries(files: UploadItem[]) {
  const visible = files.slice(
    0,
    files.length > MAX_FOLDER_ITEMS ? MAX_FOLDER_ITEMS - 1 : MAX_FOLDER_ITEMS
  )
  const entries = visible.map((file) => file.name)
  const remaining = files.length - visible.length

  if (remaining > 0) entries.push(`+${remaining} more`)
  return entries
}

function averageProgress(files: UploadItem[]) {
  if (!files.length) return 0
  return Math.round(
    files.reduce((total, file) => total + file.progress, 0) / files.length
  )
}

export function LibraryWizard() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)
  const uploadControllerRef = React.useRef<AbortController | null>(null)
  const [step, setStep] = React.useState(1)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [files, setFiles] = React.useState<UploadItem[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [createdLibrary, setCreatedLibrary] = React.useState<Library | null>(
    null
  )

  const theme = resolvedTheme === "dark" ? "dark" : "light"
  const nameIsValid = name.trim().length >= 2
  const uploadsComplete =
    files.length > 0 && files.every((file) => file.status === "complete")
  const progress = averageProgress(files)

  React.useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
  }, [])

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

  const addFiles = React.useCallback(
    async (selected: File[]) => {
      if (!selected.length) return

      uploadControllerRef.current?.abort()
      const controller = new AbortController()
      uploadControllerRef.current = controller
      setError("")
      setUploading(true)

      const currentKeys = new Set(
        files.map((file) => `${file.path}:${file.size}`)
      )
      const incoming = selected
        .map(toUploadItem)
        .filter((file) => !currentKeys.has(`${file.path}:${file.size}`))
      const combined = [...files, ...incoming]
      setFiles(combined)

      try {
        await simulateUpload(
          combined,
          (nextFiles) => setFiles(nextFiles),
          controller.signal
        )
      } catch (uploadError) {
        if (
          uploadError instanceof DOMException &&
          uploadError.name === "AbortError"
        )
          return
        setError("The files could not be prepared. Choose them again to retry.")
        setFiles((current) =>
          current.map((file) => ({ ...file, status: "error" }))
        )
      } finally {
        if (uploadControllerRef.current === controller) setUploading(false)
      }
    },
    [files]
  )

  const handleInputFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void addFiles(Array.from(event.dataTransfer.files))
  }

  const removeFile = (id: string) => {
    if (uploading) return
    setFiles((current) => current.filter((file) => file.id !== id))
  }

  const saveLibrary = async () => {
    if (!nameIsValid || !uploadsComplete || saving) return
    setSaving(true)
    setError("")

    try {
      const library = await createLibrary({
        name,
        description,
        files,
      })
      setCreatedLibrary(library)
      setStep(5)
    } catch {
      setError("The library was not saved. Keep this page open and try again.")
    } finally {
      setSaving(false)
    }
  }

  const nextDisabled =
    step === 1
      ? !nameIsValid
      : step === 2
        ? !uploadsComplete || uploading
        : step === 4
          ? saving || !nameIsValid || !uploadsComplete
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
        onStepChange={setStep}
        linear
        indicator="numbers"
        transition="slide"
        width="100%"
        radius={18}
        theme={theme}
        accentColor="var(--primary)"
        style={stepperStyle}
        nextButtonText="Continue"
        completeButtonText={saving ? "Saving…" : "Save library"}
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
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Product research"
                  autoComplete="off"
                  aria-invalid={name.length > 0 && !nameIsValid}
                />
                <FieldDescription>
                  Use at least two characters.
                </FieldDescription>
                {name.length > 0 && !nameIsValid ? (
                  <FieldError>Enter a slightly longer library name.</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="library-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="library-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What questions should this library help answer?"
                  rows={4}
                />
                <FieldDescription>
                  Optional. You can refine this later.
                </FieldDescription>
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
                open={uploadsComplete}
                peek={uploading || (files.length > 0 && !uploadsComplete)}
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
                    ? `Preparing ${files.length} ${files.length === 1 ? "file" : "files"}`
                    : uploadsComplete
                      ? `${files.length} ${files.length === 1 ? "file" : "files"} ready`
                      : "Add the documents you want to analyze"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Files stay in this browser while the backend is mocked.
                </p>
              </div>
              {files.length > 0 ? (
                <Progress
                  value={progress}
                  aria-label={`Upload progress ${progress}%`}
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
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
                    Add individual documents or choose a whole folder while
                    keeping its paths.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <FileIcon data-icon="inline-start" />
                    Choose files
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading}
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
                multiple
                onChange={handleInputFiles}
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                ref={folderInputRef}
                className="sr-only"
                type="file"
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
                        files.reduce((total, file) => total + file.size, 0)
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
                              file.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {file.status === "complete"
                              ? "Ready"
                              : `${file.progress}%`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={uploading}
                            onClick={() => removeFile(file.id)}
                            aria-label={`Remove ${file.name}`}
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
                InstaGrad will cite these files in chat and use them to build
                decision flows.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card size="sm" className="sm:col-span-2">
                <CardHeader>
                  <CardTitle>{name.trim()}</CardTitle>
                  <CardDescription>
                    {description.trim() || "No description added."}
                  </CardDescription>
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
                          {formatBytes(file.size)}
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
                  <CardDescription>Ready for analysis</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <strong className="font-heading text-4xl font-medium">
                    {files.length}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(
                      files.reduce((total, file) => total + file.size, 0)
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
                This saves {files.length}{" "}
                {files.length === 1 ? "file" : "files"} and opens a new analysis
                workspace. You can add more evidence later.
              </p>
            </div>
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
