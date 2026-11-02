"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import Lightfall from "@/components/ui/Lightfall"

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [query])

  return matches
}

function resolveColors(variables: string[]) {
  const styles = getComputedStyle(document.documentElement)
  return variables.map((variable) => styles.getPropertyValue(variable).trim()).filter(Boolean)
}

const lightColorVariables = ["--primary", "--chart-2"]
const darkColorVariables = ["--primary", "--chart-2", "--foreground"]
let webGlSupport: boolean | undefined

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  })
  return () => observer.disconnect()
}

function themeColors() {
  const dark = document.documentElement.classList.contains("dark")
  return (dark ? darkColorVariables : lightColorVariables)
}

function getPaletteSnapshot() {
  return resolveColors(themeColors()).join("|")
}

function getWebGlSnapshot() {
  if (webGlSupport === undefined) {
    const canvas = document.createElement("canvas")
    webGlSupport = Boolean(canvas.getContext("webgl2"))
  }
  return webGlSupport
}

function subscribeToVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback)
  return () => document.removeEventListener("visibilitychange", callback)
}

export function AppBackground() {
  const { resolvedTheme } = useTheme()
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const visible = React.useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => true,
  )
  const webGl = React.useSyncExternalStore(
    () => () => undefined,
    getWebGlSnapshot,
    () => false,
  )
  const paletteValue = React.useSyncExternalStore(subscribeToTheme, getPaletteSnapshot, () => "")
  const palette = React.useMemo(() => paletteValue.split("|").filter(Boolean), [paletteValue])
  const dark = resolvedTheme === "dark"

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[linear-gradient(to_bottom_right,var(--surface),var(--background))]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--border),transparent_55%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border),transparent_55%)_1px,transparent_1px)] [background-size:5rem_5rem] [mask-image:radial-gradient(110%_70%_at_80%_-6%,black,transparent_68%)]" />
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(40%_92%_at_82%_-12%,var(--signal-soft),transparent_68%)]" />
      <div className="absolute inset-x-0 top-0 h-72 [background-image:radial-gradient(ellipse_at_82%_0%,var(--ambient-primary),transparent_65%),radial-gradient(ellipse_at_100%_20%,var(--ambient-secondary),transparent_60%)] [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent_55%,black_88%),linear-gradient(to_bottom,black,transparent_72%)]" />
      {webGl && !reduceMotion && palette.length > 0 ? (
        <div className="absolute inset-x-0 top-0 h-[30rem] opacity-70 [mask-image:radial-gradient(78%_100%_at_80%_0%,black,transparent_82%)]">
          <Lightfall
            colors={palette}
            backgroundColor="transparent"
            speed={0.12}
            streakCount={1}
            streakWidth={0.75}
            streakLength={0.92}
            glow={0.72}
            density={0.3}
            twinkle={0.08}
            zoom={3.4}
            backgroundGlow={0.04}
            headGlow={0.2}
            depth={0.6}
            bloom={0.12}
            opacity={dark ? 0.3 : 0.48}
            mouseInteraction={false}
            holdToWarp={false}
            intro
            fade={0.6}
            lightMode={!dark}
            paused={!visible}
            dpr={1}
          />
        </div>
      ) : null}
    </div>
  )
}
