"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import {
  assignLibraryDocuments,
  deleteDocument,
  getDocument,
  getLibrary,
  listDocuments,
  removeLibraryDocument,
  removeLibraryDocuments,
} from "@/lib/api"
import type { DocumentDetail, DocumentOut, Library } from "@/lib/types"
import { DocumentUpload } from "@/components/library/document-upload"
import { errorMessage } from "@/components/library/upload-helpers"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 3

interface Confirmation {
  kind: "delete" | "remove"
  documents: DocumentOut[]
}

export function LibraryDocuments({ libraryId }: { libraryId?: string }) {
  const [library, setLibrary] = React.useState<Library | null>(null)
  const [documents, setDocuments] = React.useState<DocumentOut[]>([])
  const [total, setTotal] = React.useState(0)
  const [offset, setOffset] = React.useState(0)
  const [category, setCategory] = React.useState("")
  const [categoryDraft, setCategoryDraft] = React.useState("")
  const [uncategorized, setUncategorized] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [revision, refresh] = React.useReducer((value: number) => value + 1, 0)
  const [selection, setSelection] = React.useState<number[]>([])
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)
  const [mutationError, setMutationError] = React.useState("")
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [previewId, setPreviewId] = React.useState<number | null>(null)
  const [preview, setPreview] = React.useState<DocumentDetail | null>(null)
  const [previewError, setPreviewError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const readOnly = library?.isSystem === true

  React.useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      setLoading(true)
      setError("")
      setSelection([])
      try {
        const [result, currentLibrary] = await Promise.all([
          listDocuments({
            libraryId,
            uncategorized: libraryId ? undefined : uncategorized,
            category: category || undefined,
            limit: PAGE_SIZE,
            offset,
            signal: controller.signal,
          }),
          libraryId
            ? getLibrary(libraryId, controller.signal)
            : Promise.resolve(null),
        ])
        if (!active) return
        if (libraryId && !currentLibrary)
          throw new Error("This library could not be found.")
        setLibrary(currentLibrary)
        setDocuments(result.items)
        setTotal(result.total)
        if (offset > 0 && offset >= result.total)
          setOffset(
            Math.max(0, Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE)
          )
      } catch (loadError) {
        if (active && !controller.signal.aborted)
          setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [libraryId, offset, category, uncategorized, revision])

  React.useEffect(() => {
    if (previewId === null) return
    const controller = new AbortController()
    let active = true
    async function loadPreview() {
      setPreview(null)
      setPreviewError("")
      try {
        const result = await getDocument(previewId!, controller.signal)
        if (active) setPreview(result)
      } catch (previewFailure) {
        if (active && !controller.signal.aborted)
          setPreviewError(errorMessage(previewFailure))
      }
    }
    void loadPreview()
    return () => {
      active = false
      controller.abort()
    }
  }, [previewId])

  async function confirmMutation() {
    if (!confirmation || busy) return
    if (
      readOnly ||
      confirmation.documents.some((document) => document.source === "seed")
    ) {
      setMutationError("Built-in software policies are read-only.")
      return
    }
    setBusy(true)
    setMutationError("")
    try {
      if (confirmation.kind === "delete") {
        await deleteDocument(confirmation.documents[0].id)
        setNotice("Document deleted from the corpus and search index.")
      } else if (libraryId) {
        const ids = confirmation.documents.map((document) => document.id)
        if (ids.length === 1) await removeLibraryDocument(libraryId, ids[0])
        else await removeLibraryDocuments(libraryId, ids)
        setNotice(
          `${ids.length} ${ids.length === 1 ? "document removed" : "documents removed"} from this library and kept in the corpus.`
        )
      }
      setConfirmation(null)
      refresh()
    } catch (mutationFailure) {
      setMutationError(errorMessage(mutationFailure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 font-sans sm:px-6 lg:px-10 lg:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link href={libraryId ? `/libraries/${libraryId}` : "/dashboard"}>
              <ArrowLeftIcon data-icon="inline-start" />
              {libraryId ? "Back to chat" : "Back to dashboard"}
            </Link>
          </Button>
          <h1 className="font-heading text-3xl leading-tight font-medium break-words">
            {libraryId
              ? `${library?.name ?? "Library"} documents`
              : "All documents"}
          </h1>
          {readOnly ? (
            <Badge variant="secondary">Built-in · Read-only</Badge>
          ) : null}
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {readOnly
              ? "These software policies are maintained by the project and included in every query. You can read them here; add your own evidence to a separate library."
              : libraryId
                ? "Manage the evidence searched by this library. Removing membership keeps the document in the corpus."
                : "Browse uploaded documents and software policies. Uncategorized uploads can be added to a library later."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => refresh()}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
          {libraryId && library && !readOnly ? (
            <Button
              type="button"
              size="sm"
              disabled={loading || !!error}
              onClick={() => setAssignOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              Add existing documents
            </Button>
          ) : null}
        </div>
      </header>

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <div
        className={cn(
          "grid items-start gap-6",
          !readOnly && "lg:grid-cols-[minmax(0,1fr)_20rem]"
        )}
      >
        <Card size="sm">
          <CardHeader>
            <CardTitle>Evidence corpus</CardTitle>
            <CardDescription>
              {loading
                ? "Loading documents…"
                : `${total} ${total === 1 ? "document" : "documents"}${category ? ` in ${category}` : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setOffset(0)
                setCategory(categoryDraft.trim().toLowerCase())
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <FieldGroup className="min-w-40 flex-1">
                <Field>
                  <FieldLabel htmlFor="documents-category-filter">
                    Filter by category
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="documents-category-filter"
                      value={categoryDraft}
                      onChange={(event) => setCategoryDraft(event.target.value)}
                      placeholder="All categories"
                      maxLength={50}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton type="submit" variant="outline">
                        Apply
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </FieldGroup>
            </form>
            {!libraryId ? (
              <Field orientation="horizontal">
                <input
                  id="documents-uncategorized"
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={uncategorized}
                  onChange={(event) => {
                    setOffset(0)
                    setUncategorized(event.target.checked)
                  }}
                />
                <FieldLabel htmlFor="documents-uncategorized">
                  Only documents outside a library
                </FieldLabel>
              </Field>
            ) : null}
            {selection.length && libraryId && !readOnly ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{selection.length} selected</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    setMutationError("")
                    setConfirmation({
                      kind: "remove",
                      documents: documents.filter((document) =>
                        selection.includes(document.id)
                      ),
                    })
                  }}
                >
                  Remove selected from library
                </Button>
              </div>
            ) : null}
            {loading ? (
              <div
                className="flex flex-col gap-3"
                aria-label="Loading documents"
                role="status"
              >
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-3">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refresh()}
                >
                  Retry loading documents
                </Button>
              </div>
            ) : !documents.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>No documents found</EmptyTitle>
                  <EmptyDescription>
                    {category || uncategorized
                      ? "Change the filters to see more documents."
                      : readOnly
                        ? "No software policies have been loaded yet. Refresh after the policy service finishes loading them."
                        : "Upload PDF, Word, PowerPoint, CSV, text or Markdown files to start building your evidence set."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCategory("")
                      setCategoryDraft("")
                      setUncategorized(false)
                      setOffset(0)
                    }}
                  >
                    Clear filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex min-w-0 items-start gap-3 rounded-[var(--radius-control)] border border-border p-3"
                  >
                    {libraryId && !readOnly && document.source !== "seed" ? (
                      <input
                        type="checkbox"
                        checked={selection.includes(document.id)}
                        onChange={(event) =>
                          setSelection((current) =>
                            event.target.checked
                              ? [...current, document.id]
                              : current.filter((id) => id !== document.id)
                          )
                        }
                        aria-label={`Select ${document.title}`}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                    ) : (
                      <FileTextIcon
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <button
                        type="button"
                        className="w-fit max-w-full text-start text-sm font-medium break-words underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        onClick={() => setPreviewId(document.id)}
                      >
                        {document.title}
                      </button>
                      <p className="text-xs break-all text-muted-foreground">
                        {document.filename}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{document.category}</Badge>
                        {document.source === "seed" ? (
                          <Badge variant="outline">Read-only</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {document.chunk_count} indexed chunks ·{" "}
                          {document.source === "seed"
                            ? "Software policy"
                            : "Upload"}
                          {!libraryId
                            ? ` · ${document.library_id === null ? "Uncategorized" : `Library ${document.library_id}`}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setPreviewId(document.id)}
                        >
                          Read document
                        </Button>
                        {libraryId &&
                        !readOnly &&
                        document.source !== "seed" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setMutationError("")
                              setConfirmation({
                                kind: "remove",
                                documents: [document],
                              })
                            }}
                          >
                            Remove from library
                          </Button>
                        ) : null}
                        {!readOnly && document.source !== "seed" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setMutationError("")
                              setConfirmation({
                                kind: "delete",
                                documents: [document],
                              })
                            }}
                          >
                            <Trash2Icon data-icon="inline-start" />
                            Delete from corpus
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && !error && total > PAGE_SIZE ? (
              <nav
                className="flex items-center justify-between gap-3"
                aria-label="Documents pagination"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!offset}
                  onClick={() =>
                    setOffset((value) => Math.max(0, value - PAGE_SIZE))
                  }
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((value) => value + PAGE_SIZE)}
                >
                  Next
                </Button>
              </nav>
            ) : null}
          </CardContent>
        </Card>
        {!readOnly && (!libraryId || library) ? (
          <DocumentUpload libraryId={libraryId} onUploaded={() => refresh()} />
        ) : null}
      </div>

      <Dialog
        open={previewId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null)
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? "Document preview"}</DialogTitle>
            <DialogDescription>
              {preview
                ? `${preview.filename} · ${preview.category} · ${preview.chunk_count} indexed chunks`
                : "Loading the full document content."}
            </DialogDescription>
          </DialogHeader>
          {previewError ? (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          ) : preview ? (
            <article className="text-sm leading-7 break-words whitespace-pre-wrap">
              {preview.content}
            </article>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "delete"
                ? "Delete this document permanently?"
                : "Remove documents from this library?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "delete"
                ? `“${confirmation.documents[0].title}” will be deleted from the corpus and search index. Its content will no longer be available as evidence.`
                : `${confirmation?.documents.length ?? 0} documents will leave this library and remain available in the corpus as uncategorized documents.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmation?.kind === "delete" ? "destructive" : "default"
              }
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void confirmMutation()
              }}
            >
              {busy
                ? "Saving…"
                : confirmation?.kind === "delete"
                  ? "Delete permanently"
                  : "Remove from library"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {libraryId && library && !readOnly ? (
        <AssignDocumentsDialog
          key={libraryId}
          libraryId={libraryId}
          open={assignOpen}
          onOpenChange={setAssignOpen}
          onAssigned={() => {
            setNotice("Selected documents moved into this library.")
            refresh()
          }}
        />
      ) : null}
    </main>
  )
}

function AssignDocumentsDialog({
  libraryId,
  open,
  onOpenChange,
  onAssigned,
}: {
  libraryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const [documents, setDocuments] = React.useState<DocumentOut[]>([])
  const [total, setTotal] = React.useState(0)
  const [offset, setOffset] = React.useState(0)
  const [selection, setSelection] = React.useState<number[]>([])
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [revision, retry] = React.useReducer((value: number) => value + 1, 0)

  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let active = true
    async function loadAvailable() {
      setLoading(true)
      setError("")
      try {
        const result = await listDocuments({
          limit: PAGE_SIZE,
          offset,
          signal: controller.signal,
        })
        if (active) {
          setDocuments(result.items)
          setTotal(result.total)
          const unavailableIds = new Set(
            result.items
              .filter(
                (document) =>
                  document.source === "seed" ||
                  String(document.library_id) === libraryId
              )
              .map((document) => document.id)
          )
          setSelection((current) =>
            current.filter((id) => !unavailableIds.has(id))
          )
          if (offset > 0 && offset >= result.total)
            setOffset(
              Math.max(
                0,
                Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE
              )
            )
        }
      } catch (loadError) {
        if (active && !controller.signal.aborted)
          setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadAvailable()
    return () => {
      active = false
      controller.abort()
    }
  }, [open, offset, revision, libraryId])

  function closeDialog() {
    setSelection([])
    setOffset(0)
    setError("")
    onOpenChange(false)
  }

  async function assign() {
    if (!selection.length || busy) return
    setBusy(true)
    setError("")
    try {
      await assignLibraryDocuments(libraryId, selection)
      onAssigned()
      closeDialog()
    } catch (assignError) {
      setError(errorMessage(assignError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          if (next) onOpenChange(true)
          else closeDialog()
        }
      }}
    >
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Add existing documents</DialogTitle>
          <DialogDescription>
            Choose documents from the corpus. Adding a document assigned to
            another library moves it out of that library. Confirm only the
            documents you want to move.
          </DialogDescription>
        </DialogHeader>
        <p role="status" className="text-xs text-muted-foreground">
          {selection.length} selected
        </p>
        {error ? (
          <div className="flex flex-col gap-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => retry()}
            >
              Reload documents
            </Button>
          </div>
        ) : null}
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <fieldset
            className="flex max-h-80 flex-col gap-3 overflow-y-auto"
            disabled={busy}
          >
            <legend className="sr-only">
              Documents to move into the library
            </legend>
            {documents.length ? (
              documents.map((document) => (
                <label
                  key={document.id}
                  className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border p-3"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    checked={selection.includes(document.id)}
                    disabled={
                      document.source === "seed" ||
                      String(document.library_id) === libraryId
                    }
                    onChange={(event) =>
                      setSelection((current) =>
                        event.target.checked
                          ? [...current, document.id]
                          : current.filter((id) => id !== document.id)
                      )
                    }
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm break-words">
                      {document.title}
                    </span>
                    <span className="text-xs break-all text-muted-foreground">
                      #{document.id} · {document.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {document.source === "seed"
                        ? "Built-in software policy · Read-only"
                        : String(document.library_id) === libraryId
                          ? "Already in this library"
                          : document.library_id === null
                            ? "Uncategorized"
                            : `Will move from library ${document.library_id}`}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No documents are available. Upload new evidence instead.
              </p>
            )}
          </fieldset>
        )}
        {total > PAGE_SIZE ? (
          <nav
            className="flex items-center justify-between gap-2"
            aria-label="Existing documents pagination"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!offset || loading || busy}
              onClick={() =>
                setOffset((value) => Math.max(0, value - PAGE_SIZE))
              }
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading || busy}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
            >
              Next
            </Button>
          </nav>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={closeDialog}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selection.length || loading || busy}
            onClick={() => void assign()}
          >
            {busy
              ? "Moving documents…"
              : `Move ${selection.length || "selected"} ${selection.length === 1 ? "document" : "documents"} into library`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
