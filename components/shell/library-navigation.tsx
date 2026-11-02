"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LibraryBigIcon, PencilIcon, Trash2Icon } from "lucide-react"

import SwipeRow, { type SwipeAction } from "@/components/SwipeRow"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteLibrary,
  listLibraries,
  renameLibrary,
  subscribeToLibraries,
} from "@/lib/api"
import type { Library } from "@/lib/types"

type SelectedAction = { kind: "rename" | "delete"; library: Library }

export function LibraryNavigation({
  query,
  onNavigate,
}: {
  query: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const headingId = React.useId()
  const nameId = React.useId()
  const errorId = React.useId()
  const sectionRef = React.useRef<HTMLElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const returnFocusId = React.useRef("")
  const [libraries, setLibraries] = React.useState<Library[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [reload, setReload] = React.useState(0)
  const [expanded, setExpanded] = React.useState<{
    id: string
    path: string
  } | null>(null)
  const [selected, setSelected] = React.useState<SelectedAction | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [actionError, setActionError] = React.useState("")
  const [announcement, setAnnouncement] = React.useState("")

  React.useEffect(() => {
    let active = true
    let request = 0
    const refresh = async () => {
      const current = ++request
      try {
        const next = await listLibraries()
        if (!active || current !== request) return
        setLibraries(next)
        setLoadError(false)
      } catch {
        if (active && current === request) setLoadError(true)
      } finally {
        if (active && current === request) setLoading(false)
      }
    }
    void refresh()
    const unsubscribe = subscribeToLibraries(() => void refresh())
    return () => {
      active = false
      unsubscribe()
    }
  }, [reload])

  const visibleLibraries = libraries.filter((library) =>
    library.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  )
  const openedId =
    expanded?.path === pathname &&
    visibleLibraries.some((library) => library.id === expanded.id)
      ? expanded.id
      : null

  React.useEffect(() => {
    if (!openedId) return
    const closeOutside = (event: PointerEvent) => {
      const row =
        event.target instanceof Element
          ? event.target.closest("[data-library-row]")
          : null
      if (row?.getAttribute("data-library-row") !== openedId) setExpanded(null)
    }
    document.addEventListener("pointerdown", closeOutside)
    return () => document.removeEventListener("pointerdown", closeOutside)
  }, [openedId])

  const beginAction = (kind: SelectedAction["kind"], library: Library) => {
    returnFocusId.current = library.id
    setExpanded(null)
    setSelected({ kind, library })
    setName(library.name)
    setSubmitted(false)
    setActionError("")
    setDialogOpen(true)
  }

  const closeDialog = (open: boolean) => {
    if (!pending) setDialogOpen(open)
  }

  const restoreFocus = (event: Event) => {
    event.preventDefault()
    const row = sectionRef.current?.querySelector<HTMLElement>(
      `[data-library-row="${CSS.escape(returnFocusId.current)}"] [data-swipe-toggle]`
    )
    const fallback = sectionRef.current
      ?.closest("nav")
      ?.querySelector<HTMLElement>('a[href="/dashboard"]')
    const target = row ?? fallback
    if (target?.checkVisibility()) target.focus()
    else
      document
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Open navigation"]'
        )
        ?.focus()
  }

  const validationError =
    submitted && name.trim().length < 2
      ? "Use at least 2 characters for the library name."
      : ""
  const fieldError = validationError || actionError

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || selected.kind !== "rename" || pending) return
    setSubmitted(true)
    if (name.trim().length < 2) return
    setPending(true)
    setActionError("")
    try {
      const renamed = await renameLibrary(selected.library.id, name)
      setLibraries((current) =>
        current.map((library) =>
          library.id === renamed.id ? renamed : library
        )
      )
      setAnnouncement(`Library renamed to ${renamed.name}.`)
      setDialogOpen(false)
    } catch {
      setActionError("The name could not be saved. Try again.")
    } finally {
      setPending(false)
    }
  }

  const removeLibrary = async () => {
    if (!selected || selected.kind !== "delete" || pending) return
    setPending(true)
    setActionError("")
    try {
      await deleteLibrary(selected.library.id)
      setLibraries((current) =>
        current.filter((library) => library.id !== selected.library.id)
      )
      setAnnouncement(`${selected.library.name} deleted.`)
      setDialogOpen(false)
      if (
        pathname === `/libraries/${encodeURIComponent(selected.library.id)}`
      ) {
        router.replace("/dashboard")
        onNavigate?.()
      }
    } catch {
      setActionError("The library could not be deleted. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 flex-col gap-1"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="px-3 pb-1 text-xs font-normal text-muted-foreground"
      >
        Libraries
      </h2>
      {loading ? (
        <div
          className="flex flex-col gap-1"
          aria-label="Loading libraries"
          aria-busy="true"
        >
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col gap-2 px-3 py-2">
          <p role="alert" className="text-sm text-muted-foreground">
            Libraries could not be loaded.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              setReload((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </div>
      ) : visibleLibraries.length === 0 ? (
        <Empty className="items-start gap-2 p-3 text-start">
          <EmptyHeader className="items-start">
            <EmptyDescription>
              {query.trim()
                ? "No libraries match this search."
                : "Create a library to add your documents."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex min-w-0 flex-col gap-1">
          {visibleLibraries.map((library) => {
            const href = `/libraries/${encodeURIComponent(library.id)}`
            const active = pathname === href
            const actions: SwipeAction[] = [
              {
                id: "delete",
                label: "Delete",
                icon: <Trash2Icon aria-hidden="true" className="size-4" />,
                dismiss: false,
                onSelect: () => beginAction("delete", library),
              },
              {
                id: "rename",
                label: "Rename",
                icon: <PencilIcon aria-hidden="true" className="size-4" />,
                dismiss: false,
                onSelect: () => beginAction("rename", library),
              },
            ]
            return (
              <li
                key={library.id}
                className="min-w-0"
                data-library-row={library.id}
              >
                <SwipeRow
                  label={library.name}
                  actions={actions}
                  height={44}
                  radius={12}
                  actionWidth={64}
                  rowColor={active ? "var(--primary)" : "var(--sidebar)"}
                  textColor={
                    active
                      ? "var(--primary-foreground)"
                      : "var(--sidebar-foreground)"
                  }
                  actionColor="var(--destructive)"
                  drawerColor="var(--sidebar-accent)"
                  fullSwipe={false}
                  snapBounce={0}
                  haptic={false}
                  open={openedId === library.id}
                  onOpenChange={(open) =>
                    setExpanded((current) =>
                      open
                        ? { id: library.id, path: pathname }
                        : current?.id === library.id
                          ? null
                          : current
                    )
                  }
                  style={
                    {
                      "--sr-r": "var(--radius-control)",
                      "--sr-on-action": "var(--background)",
                      "--sr-on-drawer": "var(--sidebar-accent-foreground)",
                    } as React.CSSProperties
                  }
                >
                  <Link
                    href={href}
                    draggable={false}
                    aria-current={active ? "page" : undefined}
                    title={library.name}
                    className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    onClick={() => {
                      setExpanded(null)
                      onNavigate?.()
                    }}
                  >
                    <LibraryBigIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                      strokeWidth={1.9}
                    />
                    <span className="truncate">{library.name}</span>
                  </Link>
                </SwipeRow>
              </li>
            )
          })}
        </ul>
      )}

      <span className="sr-only" role="status">
        {announcement}
      </span>

      <Dialog
        open={dialogOpen && selected?.kind === "rename"}
        onOpenChange={closeDialog}
      >
        <DialogContent
          showCloseButton={!pending}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
            inputRef.current?.select()
          }}
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename library</DialogTitle>
            <DialogDescription>
              Choose a name that is easy to find in your navigation.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void saveName(event)}
            className="flex flex-col gap-6"
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={Boolean(fieldError)} data-disabled={pending}>
                <FieldLabel htmlFor={nameId}>Library name</FieldLabel>
                <Input
                  ref={inputRef}
                  id={nameId}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setActionError("")
                  }}
                  autoComplete="off"
                  disabled={pending}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? errorId : undefined}
                />
                {fieldError ? (
                  <FieldError id={errorId} role="alert">
                    {fieldError}
                  </FieldError>
                ) : null}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={pending || name.trim() === selected?.library.name}
              >
                {pending ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={dialogOpen && selected?.kind === "delete"}
        onOpenChange={closeDialog}
      >
        <AlertDialogContent
          onCloseAutoFocus={restoreFocus}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="min-w-0 break-words">
              Delete “{selected?.library.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the library and its saved conversations from this
              workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <FieldError role="alert">{actionError}</FieldError>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                void removeLibrary()
              }}
            >
              {pending ? "Deleting…" : "Delete library"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
