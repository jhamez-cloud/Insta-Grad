"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ArrowLeftIcon,
  BoxesIcon,
  FilePlus2Icon,
  LibraryBigIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react"

import { AppBackground } from "@/components/shell/app-background"
import { LibraryNavigation } from "@/components/shell/library-navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  match?: (pathname: string) => boolean
}

const workspaceItems: NavItem[] = [
  {
    label: "Libraries",
    href: "/dashboard",
    icon: LibraryBigIcon,
    match: (pathname) => pathname === "/dashboard",
  },
  {
    label: "Create library",
    href: "/libraries/new",
    icon: FilePlus2Icon,
  },
]

function BackToSite() {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      <Link
        href="/"
        aria-label="Back to InstaGrad home"
        title="Back to InstaGrad home"
      >
        <ArrowLeftIcon />
      </Link>
    </Button>
  )
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="group flex items-center gap-3 rounded-lg focus-visible:outline-none"
      aria-label="InstaGrad dashboard"
    >
      <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-primary text-primary-foreground shadow-sm transition-transform duration-150 [transition-timing-function:var(--ease-out)] group-active:scale-95 motion-reduce:transform-none">
        <BoxesIcon aria-hidden="true" className="size-5" strokeWidth={2.2} />
      </span>
      <span className="font-heading text-xl font-semibold tracking-[-0.035em]">
        InstaGrad
      </span>
    </Link>
  )
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = item.match ? item.match(pathname) : pathname === item.href
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 font-sans text-sm transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-out)] motion-reduce:transform-none",
        active
          ? "bg-primary text-primary-foreground"
          : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:translate-y-px"
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )

  const dark = mounted && resolvedTheme === "dark"
  const label = dark ? "Use light theme" : "Use dark theme"

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={`${label} (D)`}
    >
      {dark ? (
        <SunIcon data-icon="inline-start" />
      ) : (
        <MoonIcon data-icon="inline-start" />
      )}
      {mounted ? (dark ? "Light theme" : "Dark theme") : "Theme"}
      <kbd className="ms-auto font-mono text-[0.6875rem] text-muted-foreground">
        D
      </kbd>
    </Button>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = React.useState("")

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-6 p-4 pb-3">
        <div className="flex items-center gap-2.5">
          <BackToSite />
          <Brand />
        </div>
        <label className="relative block font-sans">
          <span className="sr-only">Search libraries</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search libraries"
            className="bg-background/45 ps-9"
          />
        </label>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4 font-sans"
        aria-label="Workspace"
      >
        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs text-muted-foreground">Workspace</p>
          {workspaceItems.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <LibraryNavigation query={query} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-2 flex items-center gap-3 rounded-[var(--radius-control)] bg-sidebar-accent/55 p-3 font-sans">
          <span className="grid size-8 place-items-center rounded-full bg-signal-soft text-foreground">
            <SparklesIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              Research workspace
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Mock data · local only
            </span>
          </span>
        </div>
        <ThemeToggle />
      </div>
    </div>
  )
}

function MobileHeader() {
  const [open, setOpen] = React.useState(false)

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-surface-raised/85 px-4 backdrop-blur-md lg:hidden">
      <BackToSite />
      <Brand />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            aria-label="Open navigation"
            className="ms-auto"
          >
            <MenuIcon />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[min(21rem,88vw)] p-0 motion-reduce:animate-none! motion-reduce:transition-none"
          showCloseButton
        >
          <SheetHeader className="sr-only">
            <SheetTitle>InstaGrad navigation</SheetTitle>
            <SheetDescription>
              Open a library or change the current workspace.
            </SheetDescription>
          </SheetHeader>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-surface">
      <AppBackground />
      <div className="relative grid min-h-svh lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-e border-sidebar-border lg:block">
          <SidebarContent />
        </aside>
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <MobileHeader />
          <main className="relative min-h-0 min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
