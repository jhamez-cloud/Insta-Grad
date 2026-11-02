"use client"

import * as React from "react"

import ClickSpark from "@/components/ui/ClickSpark"

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

function useCssColor(variable: string) {
  const [color, setColor] = React.useState("")

  React.useEffect(() => {
    const root = document.documentElement
    const update = () => setColor(getComputedStyle(root).getPropertyValue(variable).trim())
    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] })
    return () => observer.disconnect()
  }, [variable])

  return color
}

export function RootEffects({ children }: { children: React.ReactNode }) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const sparkColor = useCssColor("--primary")

  return (
    <ClickSpark
      className="min-h-svh"
      style={{ minHeight: "100svh" }}
      sparkColor={sparkColor || "currentColor"}
      sparkCount={7}
      sparkSize={7}
      sparkRadius={24}
      sparkWidth={1.4}
      duration={360}
      easing="ease-out"
      glow={0.35}
      ring={false}
      disabled={reduceMotion || !sparkColor}
    >
      {children}
    </ClickSpark>
  )
}
