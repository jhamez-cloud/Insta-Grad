"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CircleAlertIcon,
  FileTextIcon,
  GitBranchIcon,
  HistoryIcon,
  LibraryBigIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react"
import { useReducedMotion } from "motion/react"
import { ThinkingOrb } from "thinking-orbs"

import {
  ApiError,
  createSession,
  getDocument,
  getLibrary,
  getSession,
  listAllSessions,
  query,
  subscribeToLibraries,
} from "@/lib/api"
import type {
  DocumentDetail,
  Library,
  Message,
  MessageSource,
  QueryFailure,
  SessionOut,
} from "@/lib/types"
import {
  readTranscript,
  saveTranscript,
} from "@/components/chat/chat-transcript"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import {
  Message as MessageRow,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import PromptBar from "@/components/ui/PromptBar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { cn } from "@/lib/utils"

type View = "conversation" | "evidence"
interface ActiveRun {
  id: string
  queryId: string
  prompt: string
  status: "working" | "stopped" | "error"
  error?: string
}
const SESSION_KEY = "instagrad:policy:selected-session:"
const NEW_CONVERSATION = "new-conversation"

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed."
}
function queryFailure(cause: unknown): QueryFailure {
  const status = cause instanceof ApiError ? cause.status : undefined
  if (
    status === 408 ||
    status === 504 ||
    (cause instanceof Error && cause.name === "TimeoutError")
  )
    return {
      kind: "timeout",
      message:
        "The service did not return an answer in time. Please try again.",
      status,
    }
  if (status === 0 || status === 502 || status === 503)
    return { kind: "unavailable", message: errorMessage(cause), status }
  return {
    kind:
      cause instanceof ApiError
        ? (cause.kind ?? "response_failed")
        : "response_failed",
    message: errorMessage(cause),
    status,
  }
}
const failureLabels = {
  unavailable: "Service unavailable",
  timeout: "Request timed out",
  response_failed: "Response could not load",
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
function sessionStorageId(libraryId: string): number | null {
  try {
    const value = Number(
      new URL(window.location.href).searchParams.get("session") ??
        window.localStorage.getItem(`${SESSION_KEY}${libraryId}`)
    )
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
function rememberSession(libraryId: string, sessionId: number | null) {
  try {
    if (sessionId === null)
      window.localStorage.removeItem(`${SESSION_KEY}${libraryId}`)
    else
      window.localStorage.setItem(
        `${SESSION_KEY}${libraryId}`,
        String(sessionId)
      )
  } catch {
    /* Session selection still works without browser storage. */
  }
}

function SourceDialog({
  source,
  onClose,
}: {
  source: MessageSource | null
  onClose: () => void
}) {
  const [document, setDocument] = React.useState<DocumentDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [reload, setReload] = React.useState(0)
  React.useEffect(() => {
    if (!source?.documentId) return
    const controller = new AbortController()
    getDocument(source.documentId, controller.signal)
      .then((nextDocument) => {
        if (!controller.signal.aborted) setDocument(nextDocument)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [source, reload])
  return (
    <Dialog
      open={Boolean(source)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{source?.fileName ?? "Source document"}</DialogTitle>
          <DialogDescription>
            Original document and the excerpt retrieved for this answer.
          </DialogDescription>
        </DialogHeader>
        {source ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {source.source === "seed"
                  ? "Software policy"
                  : "Uploaded document"}
              </Badge>
              {source.category ? (
                <Badge variant="secondary">{source.category}</Badge>
              ) : null}
              {typeof source.similarity === "number" ? (
                <Badge variant="outline">
                  Similarity {source.similarity.toFixed(3)}
                </Badge>
              ) : null}
            </div>
            <p className="font-mono text-xs break-all text-muted-foreground">
              Chunk {source.chunkId ?? source.id}
            </p>
            <blockquote className="border-s-2 border-primary ps-4 leading-6 whitespace-pre-wrap">
              {source.excerpt}
            </blockquote>
          </>
        ) : null}
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => {
                setLoading(true)
                setError("")
                setReload((value) => value + 1)
              }}
            >
              Retry loading source
            </Button>
          </div>
        ) : document ? (
          <section>
            <h3 className="mb-2 font-heading text-lg">Full document</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {document.filename} · {document.chunk_count} indexed chunks
            </p>
            <pre className="font-sans text-sm leading-6 wrap-break-word whitespace-pre-wrap">
              {document.content}
            </pre>
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MessageSources({
  message,
  onSource,
}: {
  message: Message
  onSource: (source: MessageSource) => void
}) {
  if (!message.sources?.length) return null
  return (
    <AttachmentGroup aria-label="Sources used in this answer">
      {message.sources.map((source) => (
        <Attachment key={source.id} size="sm" className="max-w-72">
          <AttachmentMedia>
            <FileTextIcon aria-hidden="true" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{source.fileName}</AttachmentTitle>
            <AttachmentDescription>{source.excerpt}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentTrigger
            aria-label={`Read ${source.fileName}, chunk ${source.chunkId ?? source.id}`}
            onClick={() => onSource(source)}
          />
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}
function ChatMessage({
  message,
  onSource,
  onRetry,
  busy,
}: {
  message: Message
  onSource: (source: MessageSource) => void
  onRetry: () => void
  busy: boolean
}) {
  const user = message.role === "user"
  const [showFailure, setShowFailure] = React.useState(false)
  const failure = user ? message.failure : undefined
  const failureId = `query-failure-${message.id}`
  return (
    <MessageRow align={user ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>{user ? "You" : "InstaGrad"}</MessageHeader>
        <Bubble
          align={user ? "end" : "start"}
          variant={user ? "tinted" : "ghost"}
          className={cn(failure && "mb-8 pointer:coarse:mb-10")}
        >
          <BubbleContent className={cn(failure && "pb-5")}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </BubbleContent>
          {failure ? (
            <BubbleReactions side="bottom" align="end" className="p-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="destructive"
                    asChild
                    className="relative size-6 cursor-pointer rounded-full p-0 pointer:coarse:overflow-visible pointer:coarse:after:absolute pointer:coarse:after:-inset-3 pointer:coarse:after:content-['']"
                  >
                    <button
                      type="button"
                      data-query-failure={failure.kind}
                      aria-label={`Query failed: ${failureLabels[failure.kind]}. ${showFailure ? "Hide" : "Show"} details`}
                      aria-expanded={showFailure}
                      aria-controls={failureId}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible"))
                          setShowFailure(true)
                      }}
                      onClick={() => setShowFailure((open) => !open)}
                    >
                      <CircleAlertIcon aria-hidden="true" />
                    </button>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {failureLabels[failure.kind]}: {failure.message}
                </TooltipContent>
              </Tooltip>
            </BubbleReactions>
          ) : null}
        </Bubble>
        {failure ? (
          <div
            id={failureId}
            hidden={!showFailure}
            className="max-w-[62ch] self-end"
          >
            <p className="text-sm text-destructive">
              {failureLabels[failure.kind]}: {failure.message}
            </p>
            <Button
              variant="outline"
              size="xs"
              className="mt-2"
              disabled={busy}
              onClick={onRetry}
            >
              Retry question
            </Button>
          </div>
        ) : null}
        <MessageSources message={message} onSource={onSource} />
        <MessageFooter>
          {formatTime(message.createdAt)}
          {message.model ? ` · ${message.model}` : ""}
        </MessageFooter>
      </MessageContent>
    </MessageRow>
  )
}
function RunMessage({ run, onRetry }: { run: ActiveRun; onRetry: () => void }) {
  const reduced = useReducedMotion()
  const working = run.status === "working"
  return (
    <MessageRow align="start">
      <MessageContent>
        <MessageHeader>InstaGrad</MessageHeader>
        <Bubble variant="ghost" className={cn(working && "w-full")}>
          <BubbleContent className={cn(working && "w-full")}>
            {working ? (
              <Trace aria-label="Answer request status" className="py-1">
                <TraceLine className="w-full gap-3">
                  <TraceIcon className="size-10">
                    <ThinkingOrb
                      size={32}
                      state="solving"
                      theme="auto"
                      paused={Boolean(reduced)}
                      aria-label="Waiting for answer"
                    />
                  </TraceIcon>
                  <TraceTitle
                    role="status"
                    className="overflow-visible whitespace-normal"
                  >
                    Waiting for the policy service to retrieve sources and
                    prepare an answer…
                  </TraceTitle>
                </TraceLine>
              </Trace>
            ) : (
              <div
                role={run.status === "error" ? "alert" : "status"}
                className="flex flex-col gap-3"
              >
                <p>
                  {run.error ?? "Request canceled. No answer was received."}
                </p>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry question
                </Button>
              </div>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </MessageRow>
  )
}

function EvidenceFlow({
  library,
  messages,
  onSource,
}: {
  library: Library
  messages: Message[]
  onSource: (source: MessageSource) => void
}) {
  const answer = messages.findLast((message) => message.role === "assistant")
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 pb-12 sm:px-7 lg:px-10">
        <div>
          <Badge variant="secondary">Retrieved evidence</Badge>
          <h2 className="mt-4 font-heading text-3xl">
            From question to grounded answer
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Search combines {library.name} with software policies. Category
            filters apply to uploaded documents; policies are searched across
            categories.
          </p>
        </div>
        {!answer ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GitBranchIcon />
              </EmptyMedia>
              <EmptyTitle>No answer to inspect yet</EmptyTitle>
              <EmptyDescription>
                Ask a question in the conversation to see its retrieved
                evidence.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Trace aria-label="Retrieval results">
              <TraceLine>
                <TraceIcon>
                  <LibraryBigIcon />
                </TraceIcon>
                <TraceTitle>Selected library: {library.name}</TraceTitle>
              </TraceLine>
              <TraceLine>
                <TraceIcon>
                  <FileTextIcon />
                </TraceIcon>
                <TraceTitle>
                  {answer.sources?.length ?? 0} retrieved excerpts ·{" "}
                  {answer.model}
                </TraceTitle>
              </TraceLine>
            </Trace>
            <p className="max-w-[66ch] font-serif leading-7 whitespace-pre-wrap">
              {answer.content}
            </p>
            {answer.sources?.length ? (
              <ol
                className="flex flex-col gap-5"
                aria-label="Retrieved source excerpts"
              >
                {answer.sources.map((source, index) => (
                  <li key={source.id} className="border-b border-border pb-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-heading text-lg">
                        {index + 1}. {source.fileName}
                      </h3>
                      <Badge variant="outline">
                        {source.source === "seed"
                          ? "Software policy"
                          : "Library document"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                      {source.excerpt}
                    </p>
                    <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
                      {source.category} · {source.chunkId}
                      {typeof source.similarity === "number"
                        ? ` · similarity ${source.similarity.toFixed(3)}`
                        : ""}
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="outline"
                      onClick={() => onSource(source)}
                    >
                      Read original document
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                The service returned no supporting excerpts for this question.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LibraryChatContent({ libraryId }: { libraryId: string }) {
  const router = useRouter()
  const [library, setLibrary] = React.useState<Library | null>(null)
  const [sessions, setSessions] = React.useState<SessionOut[]>([])
  const [sessionId, setSessionId] = React.useState<number | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [run, setRun] = React.useState<ActiveRun | null>(null)
  const [view, setView] = React.useState<View>("conversation")
  const [source, setSource] = React.useState<MessageSource | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [topK, setTopK] = React.useState(3)
  const [category, setCategory] = React.useState("")
  const [reload, setReload] = React.useState(0)
  const abortRef = React.useRef<AbortController | null>(null)
  const busyRef = React.useRef(false)
  const mounted = React.useRef(true)
  const busy = run?.status === "working"

  React.useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    Promise.all([
      getLibrary(libraryId, controller.signal),
      listAllSessions(controller.signal),
    ])
      .then(async ([nextLibrary, allSessions]) => {
        if (controller.signal.aborted) return
        if (!nextLibrary)
          throw new Error(
            "This library could not be found. Choose another library."
          )
        const matching = allSessions.filter(
          (session) => String(session.library_id) === libraryId
        )
        const remembered = sessionStorageId(libraryId)
        const selected =
          matching.find((session) => session.id === remembered) ?? matching[0]
        if (selected) {
          const checked = await getSession(selected.id, controller.signal)
          if (controller.signal.aborted) return
          if (String(checked.library_id) !== libraryId)
            throw new Error(
              "The session's selected library changed. Refresh to choose a session."
            )
          setSessionId(checked.id)
          setMessages(readTranscript(checked.id, libraryId))
        } else {
          setSessionId(null)
          setMessages([])
        }
        setLibrary(nextLibrary)
        setSessions(matching)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    const unsubscribe = subscribeToLibraries(() => {
      getLibrary(libraryId, controller.signal)
        .then((nextLibrary) => {
          if (controller.signal.aborted) return
          setLibrary(nextLibrary)
          if (!nextLibrary) {
            abortRef.current?.abort()
            setError("This library has been deleted. Choose another library.")
          }
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(errorMessage(cause))
        })
    })
    return () => {
      mounted.current = false
      controller.abort()
      abortRef.current?.abort()
      unsubscribe()
    }
  }, [libraryId, reload])

  function store(nextSessionId: number, nextMessages: Message[]) {
    setMessages(nextMessages)
    if (!saveTranscript(nextSessionId, nextMessages))
      setNotice(
        "This browser could not save the conversation. Keep this page open to retain it."
      )
  }
  function chooseSession(value: string) {
    if (busyRef.current) return
    const id = value ? Number(value) : null
    setSessionId(id)
    rememberSession(libraryId, id)
    router.replace(
      `/libraries/${encodeURIComponent(libraryId)}${id === null ? "" : `?session=${id}`}`,
      { scroll: false }
    )
    setMessages(id === null ? [] : readTranscript(id, libraryId))
    setRun(null)
    setNotice("")
  }
  async function handleSend(text: string, retryId?: string) {
    const prompt = text.trim()
    if (!library || busyRef.current) return
    if (prompt.length < 3 || prompt.length > 1000) {
      setNotice("Use a question between 3 and 1,000 characters.")
      return
    }
    const selectedCategory = category.trim().toLowerCase()
    if (
      selectedCategory &&
      !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(selectedCategory)
    ) {
      setNotice(
        "Use a category of 1–50 lowercase letters, digits, hyphens, or underscores."
      )
      return
    }
    busyRef.current = true
    setNotice("")
    const controller = new AbortController()
    abortRef.current = controller
    const runId = crypto.randomUUID()
    const queryId = retryId ?? crypto.randomUUID()
    setRun({ id: runId, queryId, prompt, status: "working" })
    setView("conversation")
    let activeId = sessionId
    const retryMessage = retryId
      ? messages.find(
          (message) => message.id === retryId && message.role === "user"
        )
      : undefined
    let nextMessages: Message[] = retryMessage
      ? messages.map((message) =>
          message.id === queryId ? { ...message, failure: undefined } : message
        )
      : [
          ...messages,
          {
            id: queryId,
            sessionId: activeId ?? undefined,
            libraryId,
            role: "user",
            content: prompt,
            createdAt: new Date().toISOString(),
            status: "complete",
          },
        ]
    if (activeId === null) setMessages(nextMessages)
    else store(activeId, nextMessages)
    try {
      if (activeId === null) {
        const created = await createSession(libraryId, controller.signal)
        if (controller.signal.aborted)
          throw new DOMException("Request canceled", "AbortError")
        if (!mounted.current) return
        activeId = created.id
        setSessionId(created.id)
        setSessions((current) => [created, ...current])
        rememberSession(libraryId, created.id)
        router.replace(
          `/libraries/${encodeURIComponent(libraryId)}?session=${created.id}`,
          { scroll: false }
        )
        nextMessages = nextMessages.map((message) =>
          message.sessionId === undefined
            ? { ...message, sessionId: created.id }
            : message
        )
        store(created.id, nextMessages)
      }
      const checked = await getSession(activeId, controller.signal)
      if (String(checked.library_id) !== libraryId)
        throw new Error(
          "This session now selects another library. Choose a new session before retrying."
        )
      const result = await query(
        {
          question: prompt,
          session_id: activeId,
          top_k: topK,
          category: selectedCategory || undefined,
        },
        controller.signal
      )
      if (controller.signal.aborted)
        throw new DOMException("Request canceled", "AbortError")
      if (!mounted.current) return
      if (
        result.session_id !== activeId ||
        String(result.library_id) !== libraryId
      )
        throw new Error(
          "The selected library changed while the request was running. Start a new session to continue."
        )
      const answer: Message = {
        id: crypto.randomUUID(),
        libraryId,
        sessionId: activeId,
        role: "assistant",
        content: result.answer,
        createdAt: new Date().toISOString(),
        status: "complete",
        model: result.model,
        sources: result.sources.map((hit) => ({
          id: hit.chunk_id,
          documentId: hit.document_id,
          chunkId: hit.chunk_id,
          fileName: hit.title,
          category: hit.category,
          similarity: hit.similarity,
          source: hit.source,
          excerpt: hit.excerpt,
        })),
      }
      store(activeId, [...nextMessages, answer])
      setRun(null)
    } catch (cause) {
      if (mounted.current) {
        const failure = controller.signal.aborted
          ? undefined
          : queryFailure(cause)
        if (failure) {
          nextMessages = nextMessages.map((message) =>
            message.id === queryId ? { ...message, failure } : message
          )
          if (activeId === null) setMessages(nextMessages)
          else store(activeId, nextMessages)
        }
        setRun({
          id: runId,
          queryId,
          prompt,
          status: controller.signal.aborted ? "stopped" : "error",
          error: controller.signal.aborted
            ? "Request canceled. No answer was received."
            : failure?.message,
        })
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      busyRef.current = false
    }
  }

  if (loading)
    return (
      <div
        aria-label="Loading library and sessions"
        className="flex flex-col gap-6 p-6 lg:p-10"
      >
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="mx-auto h-40 w-full max-w-4xl" />
      </div>
    )
  if (error || !library)
    return (
      <Empty className="min-h-[calc(100svh-4rem)]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LibraryBigIcon />
          </EmptyMedia>
          <EmptyTitle>Library unavailable</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true)
              setError("")
              setReload((value) => value + 1)
            }}
          >
            Retry loading library
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Choose another library</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  return (
    <section className="relative flex h-[calc(100svh-4rem)] min-h-0 flex-col overflow-hidden font-sans lg:h-svh">
      <header className="flex flex-col gap-2 border-b border-border bg-surface-raised/80 px-4 py-3 sm:px-7 lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-heading text-lg font-semibold sm:text-xl">
              {library.name}
            </h1>
            {library.isSystem ? (
              <Badge
                variant="secondary"
                aria-label="Built-in read-only library"
              >
                <span className="hidden sm:inline">Built-in · </span>
                Read-only
              </Badge>
            ) : null}
          </div>
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="pointer:coarse:size-9"
                    aria-label="Library options"
                  >
                    <MoreHorizontalIcon aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent>Library options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {library.fileCount}{" "}
                  {library.fileCount === 1 ? "file" : "files"}
                  {library.isSystem ? " · Built-in, read-only" : ""}
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/libraries/${libraryId}/documents`}>
                    <FileTextIcon aria-hidden="true" />
                    {library.isSystem ? "Browse policies" : "Manage documents"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sessions">
                    <HistoryIcon aria-hidden="true" />
                    Manage sessions
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="whitespace-normal">
                Sessions are saved by the service. History stays in this
                browser; each question searches independently.
              </DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <FieldGroup className="flex-row items-center gap-2">
          <Field className="min-w-0 flex-1 sm:w-60 sm:flex-none">
            <FieldLabel htmlFor="chat-session" className="sr-only">
              Session
            </FieldLabel>
            <Select
              value={sessionId === null ? NEW_CONVERSATION : String(sessionId)}
              onValueChange={(value) =>
                chooseSession(value === NEW_CONVERSATION ? "" : value)
              }
              disabled={busy}
            >
              <SelectTrigger
                id="chat-session"
                size="sm"
                className="w-full min-w-0 pointer:coarse:data-[size=sm]:h-9"
                aria-label="Session"
              >
                <SelectValue>
                  {sessionId === null
                    ? "New conversation"
                    : `Session ${sessionId}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  <SelectLabel>Conversations</SelectLabel>
                  <SelectItem value={NEW_CONVERSATION}>
                    New conversation
                  </SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={String(session.id)}>
                      Session {session.id} ·{" "}
                      {new Date(session.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer:coarse:size-9"
                aria-label="New session"
                disabled={busy}
                onClick={() => chooseSession("")}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New session</TooltipContent>
          </Tooltip>
          <nav aria-label="Library views" className="shrink-0">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(nextView) => {
                if (nextView === "conversation" || nextView === "evidence")
                  setView(nextView)
              }}
              size="sm"
              spacing={1}
              aria-label="Library views"
            >
              <Tooltip>
                <ToggleGroupItem
                  asChild
                  value="conversation"
                  aria-label="Conversation"
                  className="px-2 sm:px-3 pointer:coarse:h-9 pointer:coarse:min-w-9"
                >
                  <TooltipTrigger>
                    <MessageSquareTextIcon aria-hidden="true" />
                    <span className="hidden sm:inline">Conversation</span>
                  </TooltipTrigger>
                </ToggleGroupItem>
                <TooltipContent>Conversation</TooltipContent>
              </Tooltip>
              <Tooltip>
                <ToggleGroupItem
                  asChild
                  value="evidence"
                  aria-label="Evidence flow"
                  className="px-2 sm:px-3 pointer:coarse:h-9 pointer:coarse:min-w-9"
                >
                  <TooltipTrigger>
                    <GitBranchIcon aria-hidden="true" />
                    <span className="hidden sm:inline">Evidence</span>
                  </TooltipTrigger>
                </ToggleGroupItem>
                <TooltipContent>Evidence flow</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </nav>
        </FieldGroup>
      </header>
      {notice ? (
        <div
          role="alert"
          className="px-4 py-2 text-sm text-destructive sm:px-7"
        >
          {notice}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {view === "evidence" ? (
          <EvidenceFlow
            library={library}
            messages={messages}
            onSource={setSource}
          />
        ) : (
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport className="scroll-pb-64">
                <MessageScrollerContent className="mx-auto w-full max-w-4xl px-4 pt-7 pb-64 sm:px-7 lg:px-10">
                  <MessageScrollerItem messageId="conversation-start">
                    <Marker variant="separator">
                      <MarkerIcon>
                        <LibraryBigIcon />
                      </MarkerIcon>
                      <MarkerContent>
                        {library.fileCount} library files plus software policies
                      </MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                  {!messages.length && !run ? (
                    <MessageScrollerItem messageId="welcome">
                      <MessageRow align="start">
                        <MessageContent>
                          <MessageHeader>InstaGrad</MessageHeader>
                          <Bubble variant="ghost">
                            <BubbleContent>
                              <p className="max-w-[62ch] font-serif text-[1.05rem] leading-7">
                                Ask a question grounded in this library and
                                software policies, then inspect the original
                                source excerpts.
                              </p>
                            </BubbleContent>
                          </Bubble>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {[
                              "What does this evidence support?",
                              "Where do the sources disagree?",
                              "Summarize the strongest claim",
                            ].map((suggestion) => (
                              <Button
                                key={suggestion}
                                variant="outline"
                                size="sm"
                                onClick={() => void handleSend(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </MessageContent>
                      </MessageRow>
                    </MessageScrollerItem>
                  ) : null}
                  {messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <ChatMessage
                        message={message}
                        onSource={setSource}
                        busy={busy}
                        onRetry={() =>
                          void handleSend(message.content, message.id)
                        }
                      />
                    </MessageScrollerItem>
                  ))}
                  {run ? (
                    <MessageScrollerItem messageId={run.id}>
                      <RunMessage
                        run={run}
                        onRetry={() => void handleSend(run.prompt, run.queryId)}
                      />
                    </MessageScrollerItem>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>
      {view === "conversation" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-surface via-surface/96 to-transparent px-3 pt-12 pb-4 sm:px-6 lg:px-8">
          <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-2">
            <FieldGroup className="flex-row items-end gap-3 rounded-lg bg-surface-raised p-2">
              <Field className="w-28 shrink-0">
                <FieldLabel htmlFor="chat-top-k">Chunks / corpus</FieldLabel>
                <Input
                  id="chat-top-k"
                  type="number"
                  min={1}
                  max={10}
                  value={topK}
                  disabled={busy}
                  onChange={(event) =>
                    setTopK(
                      Math.min(
                        10,
                        Math.max(1, Math.trunc(Number(event.target.value)) || 1)
                      )
                    )
                  }
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="chat-category">Upload category</FieldLabel>
                <Input
                  id="chat-category"
                  placeholder="All categories"
                  maxLength={50}
                  value={category}
                  disabled={busy}
                  onChange={(event) => setCategory(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <PromptBar
              className={cn("w-full shadow-panel")}
              width={896}
              radius={20}
              placeholder={`Ask ${library.name}…`}
              sources={[
                {
                  key: "documents",
                  name: "Manage library documents",
                  description: "Upload or change this library's sources",
                  attach: true,
                  icon: <FileTextIcon aria-hidden="true" />,
                },
              ]}
              onAttach={() =>
                router.push(
                  `/libraries/${encodeURIComponent(libraryId)}/documents`
                )
              }
              commands={[]}
              models={[]}
              efforts={[]}
              busy={busy}
              onSend={(text) => void handleSend(text)}
              onStop={() => abortRef.current?.abort()}
              background="var(--surface-raised)"
              color="var(--foreground)"
              menuBackground="var(--popover)"
              sparkColor="var(--primary)"
              maxRows={6}
            />
            <p className="text-center text-xs text-muted-foreground">
              Search uses the selected library and policies. The service applies
              its configured chunk limit.
            </p>
          </div>
        </div>
      ) : null}
      {source ? (
        <SourceDialog
          key={source.id}
          source={source}
          onClose={() => setSource(null)}
        />
      ) : null}
    </section>
  )
}
export function LibraryChat({ libraryId }: { libraryId: string }) {
  return <LibraryChatContent key={libraryId} libraryId={libraryId} />
}
