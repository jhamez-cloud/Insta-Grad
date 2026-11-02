"use client"

import * as React from "react"
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  GitBranchIcon,
  LibraryBigIcon,
  MessageSquareTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import { useReducedMotion } from "motion/react"
import { ThinkingOrb } from "thinking-orbs"

import {
  getLibrary,
  listMessages,
  streamLibraryChat,
  subscribeToLibraries,
} from "@/lib/api"
import type { Library, Message } from "@/lib/types"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
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
import PromptBar, { type PromptBarSource } from "@/components/ui/PromptBar"
import { Skeleton } from "@/components/ui/skeleton"
import ThoughtLine from "@/components/ui/ThoughtLine"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { cn } from "@/lib/utils"

type View = "conversation" | "decisions"
type RunStatus = "working" | "complete" | "stopped" | "error"

interface ActiveRun {
  id: string
  content: string
  steps: string[]
  status: RunStatus
  sources?: Message["sources"]
}

const views: Array<{
  id: View
  label: string
  icon: typeof MessageSquareTextIcon
}> = [
  { id: "conversation", label: "Conversation", icon: MessageSquareTextIcon },
  { id: "decisions", label: "Decision flow", icon: GitBranchIcon },
]

function usePageVisibility() {
  return React.useSyncExternalStore(
    (callback) => {
      document.addEventListener("visibilitychange", callback)
      return () => document.removeEventListener("visibilitychange", callback)
    },
    () => document.visibilityState === "visible",
    () => true
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function makeClientMessage(libraryId: string, content: string): Message {
  return {
    id: `local-${Date.now()}`,
    libraryId,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
    status: "complete",
  }
}

function MessageSources({ message }: { message: Message }) {
  if (!message.sources?.length) return null

  return (
    <AttachmentGroup aria-label="Sources used in this answer">
      {message.sources.map((source) => (
        <Attachment key={source.id} size="sm">
          <AttachmentMedia>
            <FileTextIcon aria-hidden="true" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{source.fileName}</AttachmentTitle>
            <AttachmentDescription>{source.excerpt}</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const user = message.role === "user"

  return (
    <MessageRow align={user ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>{user ? "You" : "InstaGrad"}</MessageHeader>
        <Bubble
          align={user ? "end" : "start"}
          variant={user ? "tinted" : "ghost"}
        >
          <BubbleContent>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </BubbleContent>
        </Bubble>
        <MessageSources message={message} />
        <MessageFooter>
          {formatTime(message.createdAt)}
          {message.status === "stopped" ? " · stopped" : null}
        </MessageFooter>
      </MessageContent>
    </MessageRow>
  )
}

function RunMessage({ run, visible }: { run: ActiveRun; visible: boolean }) {
  const reduceMotion = useReducedMotion()
  const working = run.status === "working"
  const stopped = run.status === "stopped"
  const failed = run.status === "error"

  return (
    <MessageRow align="start">
      <MessageContent>
        <MessageHeader>InstaGrad</MessageHeader>
        <Bubble variant="ghost">
          <BubbleContent className="flex w-full max-w-[46rem] flex-col gap-5">
            <div className="flex items-start gap-3 rounded-[var(--radius-control)] bg-surface-subtle/70 p-3 font-sans">
              <ThinkingOrb
                state={working ? "solving" : failed ? "shaping" : "breathing"}
                size={32}
                theme="auto"
                paused={!working || !visible || Boolean(reduceMotion)}
                aria-label={working ? "Analyzing library" : "Analysis complete"}
              />
              <ThoughtLine
                label="Reading across the library"
                doneLabel={
                  failed
                    ? "Analysis interrupted"
                    : stopped
                      ? "Stopped after"
                      : "Thought for"
                }
                steps={run.steps}
                working={working}
                color="var(--foreground)"
                glyphColor="var(--primary)"
                fontSize={14}
                settleDuration={250}
                shimmer={!reduceMotion}
              />
            </div>

            {run.content ? (
              <p className="font-serif text-[1.02rem] leading-7 whitespace-pre-wrap">
                {run.content}
              </p>
            ) : null}

            {run.steps.length > 0 && !working ? (
              <Trace aria-label="Analysis trace">
                {run.steps.map((step, index) => (
                  <TraceLine key={`${index}-${step}`}>
                    <TraceIcon>
                      <CheckIcon aria-hidden="true" />
                    </TraceIcon>
                    <TraceTitle>{step}</TraceTitle>
                  </TraceLine>
                ))}
              </Trace>
            ) : null}
          </BubbleContent>
        </Bubble>

        {run.sources?.length ? (
          <MessageSources
            message={{
              id: run.id,
              libraryId: "",
              role: "assistant",
              content: run.content,
              createdAt: new Date().toISOString(),
              status: run.status === "complete" ? "complete" : "stopped",
              sources: run.sources,
            }}
          />
        ) : null}
        <MessageFooter aria-live="polite">
          {working
            ? "Streaming response"
            : stopped
              ? "Response stopped"
              : failed
                ? "Response failed"
                : "Complete"}
        </MessageFooter>
      </MessageContent>
    </MessageRow>
  )
}

function Conversation({
  library,
  messages,
  run,
  visible,
  onPrompt,
}: {
  library: Library
  messages: Message[]
  run: ActiveRun | null
  visible: boolean
  onPrompt: (prompt: string) => void
}) {
  const empty = messages.length === 0 && !run

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-[52rem] px-4 pt-7 pb-40 sm:px-7 lg:px-10">
            <MessageScrollerItem messageId="conversation-start">
              <Marker variant="separator">
                <MarkerIcon>
                  <LibraryBigIcon aria-hidden="true" />
                </MarkerIcon>
                <MarkerContent>
                  Ask across {library.fileCount}{" "}
                  {library.fileCount === 1 ? "file" : "files"}
                </MarkerContent>
              </Marker>
            </MessageScrollerItem>

            {empty ? (
              <MessageScrollerItem messageId="welcome">
                <MessageRow align="start">
                  <MessageContent>
                    <MessageHeader>InstaGrad</MessageHeader>
                    <Bubble variant="ghost">
                      <BubbleContent>
                        <p className="max-w-[62ch] font-serif text-[1.05rem] leading-7">
                          I’m ready to compare claims, trace evidence, and turn
                          this library into a decision you can inspect.
                        </p>
                      </BubbleContent>
                    </Bubble>
                    <div className="mt-4 flex flex-wrap gap-2 font-sans">
                      {[
                        "What does this evidence support?",
                        "Where do the sources disagree?",
                        "Summarize the strongest claim",
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto rounded-full py-1.5 text-xs font-normal"
                          onClick={() => onPrompt(suggestion)}
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
                <ChatMessage message={message} />
              </MessageScrollerItem>
            ))}

            {run ? (
              <MessageScrollerItem messageId={run.id}>
                <RunMessage run={run} visible={visible} />
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function DecisionFlow({ library }: { library: Library }) {
  const leadingFiles = library.files.slice(0, 3)
  const steps = [
    {
      title: "Frame the question",
      summary: `Define the decision against the scope of ${library.name}, not against a generic benchmark.`,
      evidence: [
        `${library.fileCount} source files available`,
        "Question intent and constraints",
      ],
      confidence: "High confidence",
      icon: SearchIcon,
    },
    {
      title: "Reconcile the evidence",
      summary:
        "Compare repeated claims, contradictions, and missing context before ranking any option.",
      evidence:
        leadingFiles.length > 0
          ? leadingFiles.map((file) => file.name)
          : ["No files available yet"],
      confidence:
        leadingFiles.length > 1 ? "High confidence" : "Needs more evidence",
      icon: GitBranchIcon,
    },
    {
      title: "Test the recommendation",
      summary:
        "Challenge the preferred path against cost, adoption, reversibility, and the strongest counterargument.",
      evidence: [
        "Implementation risk",
        "Success threshold",
        "Counter-evidence",
      ],
      confidence: "Measured confidence",
      icon: ShieldCheckIcon,
    },
    {
      title: "Stage the decision",
      summary:
        "Start with a bounded pilot, record the result, then reopen the broader choice with new evidence.",
      evidence: ["Pilot scope", "Review checkpoint", "Owner and next action"],
      confidence: "Recommended path",
      icon: SparklesIcon,
    },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[58rem] flex-col gap-8 px-4 pt-8 pb-28 sm:px-7 lg:px-10 lg:pt-12">
        <div className="max-w-[44rem]">
          <Badge variant="secondary">Decision model</Badge>
          <h2 className="mt-4 font-heading text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
            A layered path from documents to action
          </h2>
          <p className="mt-3 max-w-[64ch] font-sans leading-7 text-muted-foreground">
            The flow keeps evidence, uncertainty, and the next reversible step
            visible instead of hiding them behind a single answer.
          </p>
        </div>

        <ol
          className="relative flex flex-col"
          aria-label="Decision analysis steps"
        >
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li
                key={step.title}
                className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6"
              >
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute start-[1.34rem] top-11 bottom-0 w-px bg-border sm:start-[1.72rem]"
                  />
                ) : null}
                <span className="relative grid size-11 place-items-center rounded-full border border-border bg-surface-raised text-foreground shadow-sm sm:size-14">
                  <Icon aria-hidden="true" className="size-5 sm:size-6" />
                  <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-primary font-mono text-[0.65rem] font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                </span>
                <div className="min-w-0 border-b border-border pb-8 last:border-0 sm:pb-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-heading text-xl font-medium tracking-[-0.02em] sm:text-2xl">
                      {step.title}
                    </h3>
                    <Badge
                      variant={
                        index === steps.length - 1 ? "default" : "outline"
                      }
                    >
                      {step.confidence}
                    </Badge>
                  </div>
                  <p className="mt-2 max-w-[66ch] font-sans leading-6 text-muted-foreground">
                    {step.summary}
                  </p>
                  <Trace className="mt-4" aria-label={`${step.title} evidence`}>
                    {step.evidence.map((evidence) => (
                      <TraceLine key={evidence}>
                        <TraceIcon>
                          <FileTextIcon aria-hidden="true" />
                        </TraceIcon>
                        <TraceTitle>{evidence}</TraceTitle>
                      </TraceLine>
                    ))}
                  </Trace>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div
      className="flex h-full flex-col gap-6 p-6 lg:p-10"
      aria-label="Loading library"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 pt-10">
        <Skeleton className="h-16 w-3/5" />
        <Skeleton className="ms-auto h-20 w-2/5" />
        <Skeleton className="h-28 w-4/5" />
      </div>
    </div>
  )
}

function LibraryChatContent({ libraryId }: { libraryId: string }) {
  const [library, setLibrary] = React.useState<Library | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [run, setRun] = React.useState<ActiveRun | null>(null)
  const [view, setView] = React.useState<View>("conversation")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")
  const abortRef = React.useRef<AbortController | null>(null)
  const visible = usePageVisibility()
  const busy = run?.status === "working"

  React.useEffect(() => {
    let cancelled = false

    Promise.all([getLibrary(libraryId), listMessages(libraryId)])
      .then(([nextLibrary, nextMessages]) => {
        if (cancelled) return
        if (!nextLibrary) {
          setError(
            "This library could not be found. Choose another library from the navigation."
          )
          return
        }
        setLibrary(nextLibrary)
        setMessages(nextMessages)
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The library could not be loaded. Refresh the page to try again."
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = subscribeToLibraries(() => {
      void getLibrary(libraryId)
        .then((nextLibrary) => {
          if (cancelled) return
          setLibrary(nextLibrary)
          setError(
            nextLibrary
              ? ""
              : "This library could not be found. Choose another library from the navigation."
          )
          if (!nextLibrary) abortRef.current?.abort()
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "The library could not be loaded. Refresh the page to try again."
            )
        })
    })

    return () => {
      cancelled = true
      unsubscribe()
      abortRef.current?.abort()
    }
  }, [libraryId])

  const commitRun = React.useCallback(() => {
    if (!run?.content) return
    setMessages((current) => [
      ...current,
      {
        id: run.id,
        libraryId,
        role: "assistant",
        content: run.content,
        createdAt: new Date().toISOString(),
        status: run.status === "complete" ? "complete" : "stopped",
        sources: run.sources,
      },
    ])
  }, [libraryId, run])

  const handleSend = React.useCallback(
    async (text: string) => {
      const prompt = text.trim()
      if (!prompt || busy) return

      commitRun()
      const userMessage = makeClientMessage(libraryId, prompt)
      const controller = new AbortController()
      abortRef.current = controller
      setMessages((current) => [...current, userMessage])
      setRun({
        id: `run-${Date.now()}`,
        content: "",
        steps: [],
        status: "working",
      })
      setView("conversation")

      let content = ""
      try {
        for await (const event of streamLibraryChat({
          libraryId,
          prompt,
          signal: controller.signal,
        })) {
          if (event.type === "thought") {
            setRun((current) =>
              current && !current.steps.includes(event.step.label)
                ? { ...current, steps: [...current.steps, event.step.label] }
                : current
            )
          }
          if (event.type === "token") {
            content += event.value
            setRun((current) => (current ? { ...current, content } : current))
          }
          if (event.type === "done") {
            setRun((current) =>
              current
                ? {
                    ...current,
                    content: event.message.content,
                    sources: event.message.sources,
                    status: "complete",
                  }
                : current
            )
          }
        }
      } catch (streamError) {
        const stopped =
          streamError instanceof DOMException &&
          streamError.name === "AbortError"
        setRun((current) =>
          current
            ? {
                ...current,
                content:
                  content ||
                  (stopped
                    ? "The response was stopped before the first passage was written."
                    : "The response could not be completed."),
                status: stopped ? "stopped" : "error",
              }
            : current
        )
      } finally {
        abortRef.current = null
      }
    },
    [busy, commitRun, libraryId]
  )

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  if (loading) return <LoadingState />

  if (error || !library) {
    return (
      <div className="grid min-h-[calc(100svh-4rem)] place-items-center px-6 text-center lg:min-h-svh">
        <div className="max-w-md rounded-[var(--radius-panel)] border border-border bg-surface-raised p-7 shadow-panel">
          <LibraryBigIcon
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <h1 className="mt-4 font-heading text-2xl">Library unavailable</h1>
          <p className="mt-2 font-sans leading-6 text-muted-foreground">
            {error}
          </p>
        </div>
      </div>
    )
  }

  const promptSources: PromptBarSource[] = library.files.map((file) => ({
    key: file.id,
    name: file.name,
    description: file.path,
    icon: <FileTextIcon aria-hidden="true" />,
  }))

  return (
    <section className="relative flex h-[calc(100svh-4rem)] min-h-0 flex-col overflow-hidden font-sans lg:h-svh">
      <header className="flex flex-col gap-4 border-b border-border bg-surface-raised/80 px-4 py-4 backdrop-blur-md sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-heading text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
              {library.name}
            </h1>
            <Badge variant="secondary">{library.fileCount} files</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {library.description ?? "Document analysis workspace"}
          </p>
        </div>

        <div
          className="grid grid-cols-2 rounded-[var(--radius-control)] bg-muted p-1"
          role="tablist"
          aria-label="Library views"
        >
          {views.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <Button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(item.id)}
                className={cn("min-w-0", active && "shadow-sm")}
              >
                <Icon data-icon="inline-start" />
                <span className="truncate">{item.label}</span>
              </Button>
            )
          })}
        </div>
      </header>

      <div className="relative min-h-0 flex-1" role="tabpanel">
        {view === "conversation" ? (
          <Conversation
            library={library}
            messages={messages}
            run={run}
            visible={visible}
            onPrompt={(prompt) => void handleSend(prompt)}
          />
        ) : (
          <DecisionFlow library={library} />
        )}
      </div>

      {view === "conversation" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface/96 to-transparent px-3 pt-14 pb-4 sm:px-6 lg:px-8">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[52rem] flex-col items-center gap-2">
            <PromptBar
              className="w-full shadow-panel"
              width={832}
              radius={20}
              placeholder={`Ask ${library.name}…`}
              sources={promptSources}
              models={[{ key: "instagrad", name: "InstaGrad", tag: "Library" }]}
              defaultModel="instagrad"
              efforts={["Quick", "Balanced", "Deep"]}
              defaultEffort="Balanced"
              busy={busy}
              onSend={(text) => void handleSend(text)}
              onStop={stop}
              background="var(--surface-raised)"
              color="var(--foreground)"
              menuBackground="var(--popover)"
              sparkColor="var(--primary)"
              maxRows={6}
            />
            <p className="text-center text-xs text-muted-foreground">
              Use <span className="font-mono">@</span> to focus a source. Verify
              important decisions against the original files.
            </p>
          </div>
        </div>
      ) : (
        <div className="absolute right-4 bottom-4 sm:right-7">
          <Button type="button" onClick={() => setView("conversation")}>
            Ask about this flow
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      )}
    </section>
  )
}

export function LibraryChat({ libraryId }: { libraryId: string }) {
  return <LibraryChatContent key={libraryId} libraryId={libraryId} />
}
