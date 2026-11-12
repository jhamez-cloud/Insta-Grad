"use client"

import * as React from "react"
import Link from "next/link"
import { MessageSquareTextIcon, PlusIcon, RefreshCwIcon } from "lucide-react"
import {
  createSession,
  deleteSession,
  getSession,
  listAllSessions,
  listLibraries,
  selectSessionLibrary,
} from "@/lib/api"
import type { Library, SessionOut } from "@/lib/types"
import { clearTranscript } from "@/components/chat/chat-transcript"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed."
}

function LibrarySelect({
  id,
  value,
  libraries,
  disabled,
  describedBy,
  onValueChange,
}: {
  id: string
  value: string
  libraries: Library[]
  disabled: boolean
  describedBy?: string
  onValueChange: (value: string) => void
}) {
  const selected = libraries.find((library) => library.id === value)
  return (
    <Select
      value={selected?.id ?? ""}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        id={id}
        className="w-full min-w-0"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        data-selected-library={selected?.id ?? ""}
      >
        <SelectValue
          placeholder="Choose a library"
          className="min-w-0 truncate"
        >
          {selected
            ? `${selected.name}${selected.isSystem ? " · Built-in" : ""}`
            : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className="w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]"
      >
        <SelectGroup>
          {libraries.map((library) => (
            <SelectItem
              key={library.id}
              value={library.id}
              textValue={library.name}
            >
              <span className="line-clamp-2 min-w-0 break-words">
                {library.name}
                {library.isSystem ? " · Built-in" : ""}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function SessionManager() {
  const [sessions, setSessions] = React.useState<SessionOut[]>([])
  const [libraries, setLibraries] = React.useState<Library[]>([])
  const [selectedLibrary, setSelectedLibrary] = React.useState("")
  const [choices, setChoices] = React.useState<Record<number, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const busyRef = React.useRef(false)
  const [deleting, setDeleting] = React.useState<SessionOut | null>(null)
  const [detail, setDetail] = React.useState<SessionOut | null>(null)
  const [reload, setReload] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listAllSessions(controller.signal),
      listLibraries(controller.signal),
    ])
      .then(([nextSessions, nextLibraries]) => {
        if (controller.signal.aborted) return
        setSessions(nextSessions)
        setLibraries(nextLibraries)
        setChoices({})
        setSelectedLibrary((value) =>
          nextLibraries.some((library) => library.id === value)
            ? value
            : (nextLibraries[0]?.id ?? "")
        )
        setError("")
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(message(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reload])
  async function act(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await action()
    } catch (cause) {
      setError(message(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const libraryName = (id: number | null) =>
    libraries.find((library) => library.id === String(id))?.name ??
    "Library removed"
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-7 font-sans sm:px-7 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl">Query sessions</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">
            Choose the library searched by each session. Conversations are saved
            in this browser; the service stores session selection.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setLoading(true)
            setReload((value) => value + 1)
          }}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Refresh sessions
        </Button>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Start a session</CardTitle>
          <CardDescription>
            Each question uses this library together with software policies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!selectedLibrary) return
              void act(async () => {
                const created = await createSession(selectedLibrary)
                setSessions((current) => [created, ...current])
                setNotice(
                  `Session ${created.id} created. Open it below to ask a question.`
                )
              })
            }}
          >
            <FieldGroup className="sm:flex-row sm:items-end">
              <Field
                className="min-w-0"
                data-disabled={loading || busy || !libraries.length}
              >
                <FieldLabel
                  id="new-session-library-label"
                  htmlFor="new-session-library"
                >
                  Library
                </FieldLabel>
                <LibrarySelect
                  id="new-session-library"
                  value={selectedLibrary}
                  libraries={libraries}
                  disabled={loading || busy || !libraries.length}
                  onValueChange={setSelectedLibrary}
                />
              </Field>
              <Button
                className="shrink-0"
                type="submit"
                disabled={loading || busy || !selectedLibrary}
              >
                <PlusIcon data-icon="inline-start" />
                Create session
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {!loading && !libraries.length ? (
              <Link
                href="/libraries/new"
                className="underline underline-offset-4"
              >
                Create a library first
              </Link>
            ) : (
              "Session selection can be changed at any time."
            )}
          </p>
        </CardFooter>
      </Card>
      {loading ? (
        <div aria-label="Loading sessions" className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !sessions.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareTextIcon />
            </EmptyMedia>
            <EmptyTitle>No sessions yet</EmptyTitle>
            <EmptyDescription>
              Create a session above or ask a question from a library.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((session) => {
            const chosenLibrary =
              choices[session.id] ??
              (session.library_id === null ? "" : String(session.library_id))
            const nextLibrary = libraries.some(
              (library) => library.id === chosenLibrary
            )
              ? chosenLibrary
              : ""
            return (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Session {session.id}</CardTitle>
                    <Badge
                      variant={
                        session.library_id === null ? "outline" : "secondary"
                      }
                    >
                      {libraryName(session.library_id)}
                    </Badge>
                  </div>
                  <CardDescription>
                    Created {new Date(session.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="sm:flex-row sm:items-end">
                    <Field
                      className="min-w-0"
                      data-disabled={busy || !libraries.length}
                    >
                      <FieldLabel
                        id={`session-library-${session.id}-label`}
                        htmlFor={`session-library-${session.id}`}
                      >
                        Selected library
                      </FieldLabel>
                      <LibrarySelect
                        id={`session-library-${session.id}`}
                        value={nextLibrary}
                        libraries={libraries}
                        disabled={busy || !libraries.length}
                        describedBy={`session-library-description-${session.id}`}
                        onValueChange={(value) =>
                          setChoices((current) => ({
                            ...current,
                            [session.id]: value,
                          }))
                        }
                      />
                      <FieldDescription
                        id={`session-library-description-${session.id}`}
                      >
                        Changing the library clears this browser’s conversation
                        for the session.
                      </FieldDescription>
                    </Field>
                    <Button
                      variant="outline"
                      className="shrink-0"
                      disabled={
                        busy ||
                        !nextLibrary ||
                        nextLibrary === String(session.library_id)
                      }
                      onClick={() =>
                        void act(async () => {
                          const updated = await selectSessionLibrary(
                            session.id,
                            nextLibrary
                          )
                          clearTranscript(session.id)
                          setSessions((current) =>
                            current.map((item) =>
                              item.id === updated.id ? updated : item
                            )
                          )
                          setNotice(
                            `Session ${session.id} now searches ${libraryName(updated.library_id)}.`
                          )
                        })
                      }
                    >
                      Save selection
                    </Button>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  {session.library_id !== null &&
                  libraries.some(
                    (library) => library.id === String(session.library_id)
                  ) ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/libraries/${session.library_id}?session=${session.id}`}
                      >
                        Open conversation
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select an available library to continue.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        setDetail(await getSession(session.id))
                      })
                    }
                  >
                    Session details
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setDeleting(session)}
                  >
                    Delete session
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session {detail?.id}</DialogTitle>
            <DialogDescription>
              Current session state from the policy service.
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
              <dt>Selected library</dt>
              <dd>{libraryName(detail.library_id)}</dd>
              <dt>Library ID</dt>
              <dd>{detail.library_id ?? "None"}</dd>
              <dt>Created</dt>
              <dd>{new Date(detail.created_at).toLocaleString()}</dd>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session {deleting?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the service session and its conversation saved in
              this browser. The library and documents are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                if (!deleting) return
                const session = deleting
                void act(async () => {
                  await deleteSession(session.id)
                  clearTranscript(session.id)
                  setSessions((current) =>
                    current.filter((item) => item.id !== session.id)
                  )
                  setDeleting(null)
                  setNotice(`Session ${session.id} deleted.`)
                })
              }}
            >
              {busy ? "Deleting…" : "Delete session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
