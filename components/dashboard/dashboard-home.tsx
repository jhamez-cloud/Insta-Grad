"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRightIcon,
  FileStackIcon,
  FileTextIcon,
  FolderOpenIcon,
  LibraryBigIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ServiceStatus } from "@/components/dashboard/service-status"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { listLibraries, subscribeToLibraries } from "@/lib/api"
import type { Library } from "@/lib/types"

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Creation date unavailable"
    : `Created ${dateFormatter.format(date)}`
}

function LoadingState() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]"
      aria-label="Loading libraries"
    >
      <Skeleton className="h-72 rounded-[var(--radius-panel)]" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 rounded-[var(--radius-control)]" />
        <Skeleton className="h-20 rounded-[var(--radius-control)]" />
        <Skeleton className="h-20 rounded-[var(--radius-control)]" />
      </div>
    </div>
  )
}

function FeaturedLibrary({ library }: { library: Library }) {
  const files = library.files.slice(0, 3)

  return (
    <Card className="min-h-72">
      <CardHeader>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="grid size-11 place-items-center rounded-[var(--radius-control)] bg-primary text-primary-foreground">
            <LibraryBigIcon aria-hidden="true" />
          </div>
          <Badge variant="secondary">Continue working</Badge>
        </div>
        <CardTitle className="text-2xl tracking-[-0.035em]">
          {library.name}
        </CardTitle>
        <CardDescription className="max-w-xl leading-relaxed">
          {library.description ||
            "A focused collection ready for document analysis."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {files.length > 0 ? (
          <ul
            className="flex flex-col gap-2"
            aria-label={`Files in ${library.name}`}
          >
            {files.map((file) => (
              <li
                key={file.id}
                className="flex min-w-0 items-center gap-2 font-sans text-sm text-muted-foreground"
              >
                <FileTextIcon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-sans text-sm text-muted-foreground">
            No files added yet.
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap justify-between gap-3 border-t">
        <div className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
          <FileStackIcon aria-hidden="true" className="size-4" />
          <span>
            {library.fileCount} {library.fileCount === 1 ? "file" : "files"}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatUpdatedAt(library.updatedAt)}</span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/libraries/${library.id}/documents`}>
            Manage documents
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/libraries/${library.id}`}>
            Open library
            <ArrowUpRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function LibraryRow({ library }: { library: Library }) {
  const fileNames = library.files.slice(0, 2).map((file) => file.name)

  return (
    <li className="@container">
      <Link
        href={`/libraries/${library.id}`}
        className="group grid min-h-24 gap-3 rounded-[var(--radius-control)] px-3 py-4 transition-[background-color,transform] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted/70 active:translate-y-px motion-reduce:transform-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-muted text-foreground transition-colors group-hover:bg-signal-soft">
            <FolderOpenIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-base font-medium">
              {library.name}
            </span>
            <span className="mt-1 block truncate font-sans text-sm text-muted-foreground">
              {fileNames.length > 0
                ? fileNames.join(", ")
                : "No files added yet"}
            </span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-3 ps-12 font-sans text-xs text-muted-foreground sm:justify-end sm:ps-0">
          <span>
            {library.fileCount} {library.fileCount === 1 ? "file" : "files"}
          </span>
          <span className="hidden @min-[26rem]:inline">
            {formatUpdatedAt(library.updatedAt)}
          </span>
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 text-foreground"
          />
        </span>
      </Link>
    </li>
  )
}

function LibraryList({ libraries }: { libraries: Library[] }) {
  if (libraries.length === 0) return null

  return (
    <section
      aria-labelledby="other-libraries-title"
      className="min-w-0 rounded-[var(--radius-panel)] border border-border bg-surface-raised/70 p-3"
    >
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <h2
          id="other-libraries-title"
          className="font-heading text-lg font-medium"
        >
          More libraries
        </h2>
        <Badge variant="outline">{libraries.length}</Badge>
      </div>
      <Separator className="my-2" />
      <ul className="flex flex-col">
        {libraries.map((library, index) => (
          <React.Fragment key={library.id}>
            <LibraryRow library={library} />
            {index < libraries.length - 1 ? <Separator /> : null}
          </React.Fragment>
        ))}
      </ul>
    </section>
  )
}

function EmptyLibraries({ query }: { query: string }) {
  const searching = query.trim().length > 0

  return (
    <Empty className="min-h-96 border border-border bg-surface-raised/60">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {searching ? <SearchIcon /> : <LibraryBigIcon />}
        </EmptyMedia>
        <EmptyTitle>
          {searching ? "No matching libraries" : "Create your first library"}
        </EmptyTitle>
        <EmptyDescription>
          {searching
            ? "Try a different library name or file name."
            : "Bring related files together, then ask questions across the whole collection."}
        </EmptyDescription>
      </EmptyHeader>
      {!searching ? (
        <EmptyContent>
          <Button asChild>
            <Link href="/libraries/new">
              <PlusIcon data-icon="inline-start" />
              Create library
            </Link>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export function DashboardHome() {
  const [libraries, setLibraries] = React.useState<Library[]>([])
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  const refresh = React.useCallback(async () => {
    try {
      const nextLibraries = await listLibraries()
      setLibraries(nextLibraries)
      setError("")
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Libraries could not be loaded. Try again."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let active = true

    void listLibraries()
      .then((nextLibraries) => {
        if (!active) return
        setLibraries(nextLibraries)
        setError("")
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Libraries could not be loaded. Try again."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const unsubscribe = subscribeToLibraries(() => void refresh())
    return () => {
      active = false
      unsubscribe()
    }
  }, [refresh])

  const filteredLibraries = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return libraries

    return libraries.filter((library) =>
      [
        library.name,
        library.description ?? "",
        ...library.files.map((file) => file.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    )
  }, [libraries, query])

  const featuredLibrary = filteredLibraries[0]
  const remainingLibraries = filteredLibraries.slice(1)
  const totalFiles = libraries.reduce(
    (total, library) => total + library.fileCount,
    0
  )

  return (
    <div className="h-full min-h-[calc(100svh-4rem)] overflow-y-auto lg:min-h-svh">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 font-sans text-sm text-muted-foreground">
              Your document workspace
            </p>
            <h1 className="max-w-[17ch] font-heading text-4xl leading-[1.05] font-medium tracking-[-0.045em] text-balance sm:text-5xl">
              Ask better questions of your files.
            </h1>
          </div>
          <Button asChild size="lg" className="self-start sm:self-end">
            <Link href="/libraries/new">
              <PlusIcon data-icon="inline-start" />
              Create library
            </Link>
          </Button>
        </header>

        <ServiceStatus />

        <section
          className="grid grid-cols-2 gap-4 border-y border-border py-5 font-sans"
          aria-label="Workspace summary"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-muted text-foreground">
              <LibraryBigIcon aria-hidden="true" className="size-4" />
            </span>
            <span>
              <strong className="block text-lg font-medium text-foreground">
                {libraries.length}
              </strong>
              <span className="text-sm text-muted-foreground">Libraries</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-muted text-foreground">
              <FileStackIcon aria-hidden="true" className="size-4" />
            </span>
            <span>
              <strong className="block text-lg font-medium text-foreground">
                {totalFiles}
              </strong>
              <span className="text-sm text-muted-foreground">
                Documents in libraries
              </span>
            </span>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <label htmlFor="library-search" className="sr-only">
              Search libraries
            </label>
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="library-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search libraries and files"
              className="ps-9"
            />
          </div>
          <p
            className="font-sans text-sm text-muted-foreground"
            aria-live="polite"
          >
            {loading
              ? "Loading libraries"
              : `${filteredLibraries.length} ${filteredLibraries.length === 1 ? "library" : "libraries"}`}
          </p>
        </div>

        {error ? (
          <div
            className="flex flex-col items-start gap-3 rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/10 p-4 font-sans text-sm text-destructive"
            role="alert"
          >
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true)
                setError("")
                void refresh()
              }}
            >
              Try again
            </Button>
          </div>
        ) : loading ? (
          <LoadingState />
        ) : featuredLibrary ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <FeaturedLibrary library={featuredLibrary} />
            <LibraryList libraries={remainingLibraries} />
          </div>
        ) : (
          <EmptyLibraries query={query} />
        )}
      </div>
    </div>
  )
}
