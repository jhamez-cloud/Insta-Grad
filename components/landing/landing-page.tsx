"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import {
  ArrowRightIcon,
  FilesIcon,
  GitBranchIcon,
  MessageSquareTextIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import Lightfall from "@/components/ui/Lightfall"
import ParticleText from "@/components/ui/ParticleText"
import PromptBar, { type PromptBarSource } from "@/components/ui/PromptBar"

type VisualTokens = {
  background: string
  foreground: string
  popover: string
  primary: string
  chart: string
  surface: string
  surfaceRaised: string
  fontFamily: string
}

const promptSources: PromptBarSource[] = [
  {
    key: "files",
    name: "Create a library",
    description: "Text and Markdown documents",
    icon: <FilesIcon aria-hidden="true" />,
    attach: true,
  },
]

const fallbackTokens: VisualTokens = {
  background: "currentColor",
  foreground: "currentColor",
  popover: "currentColor",
  primary: "currentColor",
  chart: "currentColor",
  surface: "currentColor",
  surfaceRaised: "currentColor",
  fontFamily: "serif",
}

function readVisualTokens(): VisualTokens {
  const root = getComputedStyle(document.documentElement)
  const token = (name: string) => root.getPropertyValue(name).trim()

  return {
    background: token("--background"),
    foreground: token("--foreground"),
    popover: token("--popover"),
    primary: token("--primary"),
    chart: token("--chart-2"),
    surface: token("--surface"),
    surfaceRaised: token("--surface-raised"),
    fontFamily: root.fontFamily,
  }
}

function useLandingEnvironment() {
  const reduceMotion = useReducedMotion()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden
  )
  const [webgl, setWebgl] = useState(false)
  const [tokens, setTokens] = useState<VisualTokens>(fallbackTokens)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = document.createElement("canvas")
      setWebgl(Boolean(canvas.getContext("webgl2")))
      setMounted(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const frame = requestAnimationFrame(() => setTokens(readVisualTokens()))
    return () => cancelAnimationFrame(frame)
  }, [mounted, resolvedTheme])

  useEffect(() => {
    const handleVisibility = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", handleVisibility)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  return {
    mounted,
    reduceMotion: Boolean(reduceMotion),
    resolvedTheme,
    setTheme,
    tokens,
    visible,
    webgl,
  }
}

function BrandMark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-sans font-semibold"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <SparklesIcon aria-hidden="true" className="size-4" />
      </span>
      <span>InstaGrad</span>
    </Link>
  )
}

function WorkspacePreview() {
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)] px-4 sm:px-6">
      <div className="overflow-hidden rounded-[var(--radius-stage)] border bg-surface-raised [box-shadow:var(--shadow-soft)]">
        <div className="grid min-h-[32rem] md:grid-cols-[15rem_1fr]">
          <aside className="hidden border-e bg-sidebar p-5 font-sans text-sidebar-foreground md:flex md:flex-col">
            <div className="flex items-center gap-2 font-medium">
              <span className="grid size-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <SparklesIcon aria-hidden="true" className="size-3.5" />
              </span>
              Research library
            </div>
            <div className="mt-7 rounded-[var(--radius-control)] border border-sidebar-border bg-sidebar-accent px-3 py-2 text-xs text-sidebar-accent-foreground">
              Search 24 sources
            </div>
            <nav
              aria-label="Preview library"
              className="mt-7 flex flex-col gap-1 text-sm"
            >
              <span className="rounded-[var(--radius-control)] bg-sidebar-primary px-3 py-2.5 text-sidebar-primary-foreground">
                Market expansion
              </span>
              <span className="px-3 py-2.5 text-sidebar-foreground/60">
                Customer interviews
              </span>
              <span className="px-3 py-2.5 text-sidebar-foreground/60">
                Quarterly metrics
              </span>
              <span className="px-3 py-2.5 text-sidebar-foreground/60">
                Competitor notes
              </span>
            </nav>
            <div className="mt-auto border-t border-sidebar-border pt-4 text-xs text-sidebar-foreground/60">
              24 files indexed
            </div>
          </aside>

          <div className="relative flex min-w-0 flex-col bg-background">
            <header className="flex items-center justify-between border-b px-5 py-4 font-sans sm:px-7">
              <div>
                <p className="text-sm font-medium">
                  Should we enter the education market?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Analysis across 24 sources
                </p>
              </div>
              <span className="rounded-full bg-signal-soft px-3 py-1 text-xs text-foreground">
                Decision ready
              </span>
            </header>

            <div className="flex flex-1 flex-col px-5 py-7 sm:px-8 sm:py-9">
              <div className="ms-auto max-w-[31rem] rounded-[var(--radius-panel)] bg-muted px-4 py-3 font-sans text-sm">
                Compare the strongest evidence for entering now versus waiting
                one year.
              </div>

              <div className="mt-8 max-w-[46rem]">
                <div className="flex items-center gap-2 font-sans text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary" />
                  Reviewed the library and tested the recommendation
                </div>
                <h2 className="mt-4 max-w-[18ch] text-3xl leading-tight tracking-tight sm:text-4xl">
                  Enter through a bounded pilot, not a full rollout.
                </h2>
                <p className="mt-4 max-w-[66ch] text-sm leading-7 text-muted-foreground sm:text-base">
                  Demand is credible in two segments, but procurement timing and
                  implementation support remain uneven. A six-month pilot
                  preserves the upside while producing the evidence needed for
                  the larger decision.
                </p>

                <ol className="mt-7 flex flex-col border-s font-sans">
                  {[
                    [
                      "Signal",
                      "Repeated demand in interview and market sources",
                    ],
                    [
                      "Constraint",
                      "Long procurement cycles in larger institutions",
                    ],
                    [
                      "Decision",
                      "Pilot with two smaller partners and a clear success threshold",
                    ],
                  ].map(([title, detail], index) => (
                    <li key={title} className="relative ps-6 pb-5 last:pb-0">
                      <span className="absolute -start-[0.44rem] top-0 grid size-3.5 place-items-center rounded-full bg-primary text-[0.55rem] text-primary-foreground">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-auto pt-10">
                <div className="rounded-[var(--radius-stage)] border bg-surface-raised p-4 font-sans text-sm text-muted-foreground [box-shadow:var(--shadow-panel)]">
                  Ask a follow-up about risks, sources, or the next decision.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalysisSequence() {
  const steps = [
    {
      icon: FilesIcon,
      title: "Build one evidence library",
      body: "Upload text or Markdown documents into a library. Manage its sources before asking a question.",
      detail: "TXT · MD · Markdown",
    },
    {
      icon: MessageSquareTextIcon,
      title: "Ask in the language of the decision",
      body: "Each question searches your selected library and shared software policies. Filter document categories and inspect the sources returned with the answer.",
      detail: "Sources remain attached to each answer",
    },
    {
      icon: GitBranchIcon,
      title: "Inspect the retrieved evidence",
      body: "Read the cited passages and open the full source documents to check an answer against its evidence.",
      detail: "Evidence before confidence",
    },
  ]

  return (
    <section
      id="how-it-works"
      aria-labelledby="sequence-title"
      className="px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto max-w-[var(--content-max)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2
              id="sequence-title"
              className="max-w-[20ch] text-4xl leading-[1.06] tracking-tight text-balance sm:text-5xl"
            >
              From document pile to reviewable decision.
            </h2>
            <p className="mt-5 max-w-[38rem] text-base leading-7 text-muted-foreground">
              The workflow follows how analysis actually happens: collect the
              evidence, question it, then expose the reasoning for review.
            </p>
          </div>

          <ol className="border-t">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <li
                  key={step.title}
                  className="grid gap-5 border-b py-8 sm:grid-cols-[3.5rem_1fr] sm:py-10"
                >
                  <div className="flex items-center gap-3 sm:block">
                    <span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-signal-soft text-foreground">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground sm:mt-4 sm:block">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl leading-tight tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-[62ch] font-sans text-sm leading-7 text-muted-foreground sm:text-base">
                      {step.body}
                    </p>
                    <p className="mt-4 font-mono text-xs text-foreground/70">
                      {step.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const router = useRouter()
  const environment = useLandingEnvironment()
  const showMotion = environment.mounted && !environment.reduceMotion
  const showLightfall = showMotion && environment.webgl
  const isDark = environment.resolvedTheme === "dark"
  const themeLabel = !environment.mounted
    ? "Toggle theme"
    : isDark
      ? "Use light theme"
      : "Use dark theme"

  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <section className="relative isolate min-h-svh border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_18%_12%,var(--ambient-primary),transparent_58%),radial-gradient(ellipse_at_84%_30%,var(--ambient-secondary),transparent_62%),radial-gradient(circle_at_50%_18%,var(--signal-soft),transparent_40%),linear-gradient(to_bottom,var(--surface),var(--background))]"
        />
        {showLightfall ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,black_38%,transparent_78%)]"
          >
            <Lightfall
              colors={
                isDark
                  ? [
                      environment.tokens.primary,
                      environment.tokens.chart,
                      environment.tokens.foreground,
                    ]
                  : [environment.tokens.primary, environment.tokens.chart]
              }
              backgroundColor={environment.tokens.background}
              speed={0.3}
              streakCount={2}
              streakWidth={0.9}
              streakLength={0.9}
              glow={1.1}
              density={0.48}
              twinkle={0.12}
              zoom={2.2}
              backgroundGlow={0.06}
              headGlow={0.65}
              depth={0.45}
              bloom={0.22}
              opacity={isDark ? 0.46 : 0.64}
              mouseInteraction={false}
              holdToWarp={false}
              intro
              fade={0.6}
              lightMode={!isDark}
              paused={!environment.visible}
              dpr={1}
            />
          </div>
        ) : null}

        <header className="mx-auto flex w-full max-w-[var(--content-max)] items-center justify-between px-4 py-5 sm:px-6 sm:py-7">
          <BrandMark />
          <nav
            aria-label="Primary"
            className="flex items-center gap-1 font-sans"
          >
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <a href="#how-it-works">How it works</a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={themeLabel}
              onClick={() => environment.setTheme(isDark ? "light" : "dark")}
            >
              {environment.mounted && isDark ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/dashboard">Open workspace</Link>
            </Button>
          </nav>
        </header>

        <div className="mx-auto flex min-h-[calc(100svh-5.5rem)] w-full max-w-[var(--content-max)] flex-col items-center justify-center px-4 pb-16 text-center sm:px-6 sm:pb-20">
          <div className="h-40 w-full sm:h-56 lg:h-72">
            {showMotion ? (
              <ParticleText
                text="InstaGrad"
                intro="gather"
                trigger="mount"
                color="currentColor"
                highlightColor={environment.tokens.primary}
                highlightMode="motion"
                fontFamily={environment.tokens.fontFamily}
                fontSize="clamp(3.5rem, 12vw, 8.5rem)"
                fontWeight={600}
                particleSize={2}
                density={5}
                scatter={150}
                gatherDuration={1600}
                stagger={360}
                clickBurst
                burstStrength={0.65}
                pointerRepel={26}
                repelRadius={110}
                idleDrift={0.25}
                glow={isDark}
              />
            ) : (
              <div className="grid h-full place-items-center">
                <span
                  aria-hidden="true"
                  className="text-[clamp(3.5rem,12vw,8.5rem)] leading-[0.9] font-semibold tracking-[-0.06em]"
                >
                  InstaGrad
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 max-w-[44rem] sm:mt-4">
            <h1 className="sr-only">InstaGrad document analysis</h1>
            <p className="text-2xl leading-tight tracking-tight text-balance sm:text-3xl lg:text-4xl">
              Turn a folder of evidence into a decision your team can inspect.
            </p>
            <p className="mx-auto mt-4 max-w-[58ch] font-sans text-sm leading-7 text-foreground/65 sm:text-base">
              Create a library, ask questions about its documents, and review
              the cited passages behind each answer.
            </p>
          </div>

          <div className="mt-8 w-full max-w-3xl text-start sm:mt-10">
            <PromptBar
              className="w-full shadow-panel"
              width={760}
              radius={18}
              placeholder="What decision are these documents helping you make?"
              sources={promptSources}
              commands={[]}
              models={[]}
              efforts={[]}
              background="var(--surface-raised)"
              color="var(--foreground)"
              menuBackground="var(--popover)"
              sparkColor="var(--primary)"
              sparkBoost={0.7}
              maxRows={4}
              onAttach={() => router.push("/libraries/new")}
              onSend={() => router.push("/dashboard")}
            />
          </div>
          <p className="mt-3 font-sans text-xs text-foreground/65">
            Open the workspace and select a library to ask a question.
          </p>

          <Button asChild size="lg" className="mt-7 sm:hidden">
            <Link href="/dashboard">
              Open workspace
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="preview-title" className="py-20 sm:py-28">
        <div className="mx-auto mb-10 max-w-[var(--content-max)] px-4 sm:px-6">
          <div className="max-w-[50rem]">
            <h2
              id="preview-title"
              className="text-4xl leading-[1.06] tracking-tight text-balance sm:text-5xl"
            >
              Analysis that keeps its evidence in view.
            </h2>
            <p className="mt-5 max-w-[62ch] font-sans text-base leading-7 text-muted-foreground">
              Answers include retrieved source passages, their document titles,
              and provenance. The illustration below shows the workspace
              concept.
            </p>
          </div>
        </div>
        <WorkspacePreview />
      </section>

      <AnalysisSequence />

      <section className="border-t px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-[var(--content-max)]">
          <h2 className="max-w-[24ch] text-4xl leading-[1.06] tracking-tight text-balance sm:text-5xl">
            Start with the documents already on your desk.
          </h2>
          <p className="mt-5 max-w-[54ch] font-sans text-base leading-7 text-muted-foreground">
            Create a library, upload text or Markdown, and start a session
            grounded in your documents and shared software policies.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/dashboard">
              Open InstaGrad
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t px-4 py-6 font-sans text-xs text-muted-foreground sm:px-6">
        <div className="mx-auto flex max-w-[var(--content-max)] items-center justify-between gap-4">
          <span>InstaGrad</span>
          <span>Evidence first. Decisions second.</span>
        </div>
      </footer>
    </main>
  )
}
