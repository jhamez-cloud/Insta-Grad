"use client"

import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const HYST = 10
const FLICK = 110
const DECEL = 0.998
const VMAX = 1500
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const SPRING_UI = { type: "spring" as const, duration: 0.3, bounce: 0 }
const DEFAULT_ACTIONS: SwipeAction[] = [{ id: "delete", label: "Delete" }]

export interface SwipeAction {
  id: string
  label: string
  icon?: ReactNode
  color?: string
  dismiss?: boolean
  onSelect?: () => void
}

export interface SwipeRowProps {
  children?: ReactNode
  actions?: SwipeAction[]
  actionColor?: string
  drawerColor?: string
  rowColor?: string
  textColor?: string
  height?: number
  radius?: number
  actionWidth?: number
  direction?: "left" | "right"
  snapBounce?: number
  resistance?: number
  collapseMs?: number
  commitAt?: number
  fullSwipe?: boolean
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onAction?: (action: SwipeAction) => void
  onCommit?: (action: SwipeAction) => void
  closeOnAction?: boolean
  haptic?: boolean
  label?: string
  className?: string
  style?: CSSProperties
}

type Sample = [number, number]
type Phase = "idle" | "committing" | "collapsing"

interface Grip {
  id: number
  x0: number
  y0: number
  grab: number | null
  moved: boolean
  hist: Sample[]
  touch: boolean
}

interface Live {
  move: (e: PointerEvent) => void
  up: (e: PointerEvent) => void
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))
const rubber = (o: number, dim: number, c: number) =>
  (o * dim * c) / (dim + c * Math.abs(o))
const unrubber = (y: number, dim: number, c: number) =>
  (y * dim) / (c * Math.max(1, dim - Math.abs(y)))
const project = (v: number) => ((v / 1000) * DECEL) / (1 - DECEL)
const velocityOf = (hist: Sample[]) => {
  if (hist.length < 2) return 0
  const a = hist[0]
  const b = hist[hist.length - 1]
  return ((b[1] - a[1]) / Math.max(1, b[0] - a[0])) * 1000
}
const onColor = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return "#ffffff"
  const h = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join("") : m[1]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#111111" : "#ffffff"
}
const watchWindow = (live: { current: Live }) => {
  const onMove = (e: PointerEvent) => {
    if (e.isTrusted) live.current.move(e)
  }
  const onUp = (e: PointerEvent) => {
    if (e.isTrusted) live.current.up(e)
  }
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
  return () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
  }
}

const SwipeRow: React.FC<SwipeRowProps> = ({
  children,
  actions = DEFAULT_ACTIONS,
  actionColor = "#e5484d",
  drawerColor = "#3f3f46",
  rowColor = "#27272a",
  textColor = "#f5f5f5",
  height = 64,
  radius = 16,
  actionWidth = 80,
  direction = "left",
  snapBounce = 0.2,
  resistance = 0.55,
  collapseMs = 200,
  commitAt = 0.6,
  fullSwipe = true,
  disabled = false,
  open: openProp,
  onOpenChange,
  onAction,
  onCommit,
  closeOnAction = true,
  haptic = true,
  label = "List item",
  className = "",
  style,
}) => {
  const uid = useId()
  const reduce = useReducedMotion()
  const s = direction === "left" ? -1 : 1
  const A = actionWidth
  const n = actions.length
  const D = n * A
  const c = clamp(resistance, 0.05, 1)
  const primary = actions[0]
  const [openState, setOpenState] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [say, setSay] = useState("")
  const open = openProp ?? openState

  const root = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const w = useRef(360)
  const grip = useRef<Grip | null>(null)
  const unwatch = useRef<(() => void) | null>(null)
  const live = useRef<Live>({} as Live)
  const foldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const heading = useRef<number | null>(null)
  const suppressClick = useRef(false)

  const x = useMotionValue(0)
  const spread = useMotionValue(0)
  const landed = useMotionValue(0)
  const commitPoint = () => Math.max(commitAt * w.current, D + A / 2)
  const canCommit = () => fullSwipe && n > 0 && commitPoint() <= w.current
  const exposed = useTransform(x, (v) => s * v)
  const surfaceXf = useTransform(x, (v) => `translateX(${v}px)`)
  const railXf = useTransform(
    exposed,
    (e: number) => `translateX(${-s * Math.max(0, D - e)}px)`
  )
  const shift = useTransform(
    [exposed, spread],
    ([e, p]: number[]) => p * Math.max(0, e - A)
  )
  const blockXf = useTransform(shift, (v) => `translateX(${s * v}px)`)
  const glyphXf = useTransform(
    [shift, landed],
    ([v, l]: number[]) => `translateX(${-s * l * (v - (w.current - A) / 2)}px)`
  )

  const map = (raw: number) => {
    const W = w.current
    if (raw < 0) return rubber(raw, W, c)
    if (raw <= D) return raw
    if (!canCommit()) return D + rubber(raw - D, W, c)
    const C = commitPoint()
    const knee = D + (C - D) / c
    return raw <= knee ? D + c * (raw - D) : C + rubber(raw - knee, W, c)
  }
  const inv = (ex: number) => {
    const W = w.current
    if (ex < 0) return unrubber(ex, W, c)
    if (ex <= D) return ex
    if (!canCommit()) return D + unrubber(ex - D, W, c)
    const C = commitPoint()
    const knee = D + (C - D) / c
    return ex <= C ? D + (ex - D) / c : knee + unrubber(ex - C, W, c)
  }

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return undefined
    w.current = el.offsetWidth || w.current
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) w.current = width
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(
    () => () => {
      clearTimeout(foldTimer.current)
      unwatch.current?.()
    },
    []
  )

  const setOpen = (next: boolean) => {
    if (next === open) return
    setOpenState(next)
    onOpenChange?.(next)
  }
  const settle = (target: number, v = 0) => {
    heading.current = target
    if (reduce) {
      x.set(s * target)
      return
    }
    const flick = Math.abs(v) >= FLICK
    animate(
      x,
      s * target,
      flick
        ? {
            type: "spring",
            duration: 0.4,
            bounce: snapBounce,
            velocity: s * clamp(v, -VMAX, VMAX),
          }
        : { ...SPRING_UI, velocity: s * v }
    )
  }
  const setSpread = (on: boolean) => {
    if ((spread.get() === 1) === on) return
    if (reduce) spread.set(on ? 1 : 0)
    else animate(spread, on ? 1 : 0, SPRING_UI)
    if (on && primary) {
      setSay(`Release to ${primary.label}`)
      if (haptic && grip.current?.touch) navigator.vibrate?.(8)
    }
  }
  const commit = (a: SwipeAction, viaKey: boolean, v = 0) => {
    const leap = a === primary
    setPhase("committing")
    setSay(a.label)
    setOpen(false)
    const fold = () => {
      setPhase("collapsing")
      foldTimer.current = setTimeout(() => {
        onCommit?.(a)
        a.onSelect?.()
      }, collapseMs)
    }
    if (viaKey || reduce) {
      if (leap) {
        spread.set(1)
        landed.set(1)
      }
      if (viaKey) {
        x.set(s * w.current)
        fold()
      } else
        animate(x, s * w.current, { duration: 0.2, ease: EASE_OUT }).then(fold)
      return
    }
    if (leap) {
      if (spread.get() < 1) animate(spread, 1, SPRING_UI)
      animate(landed, 1, SPRING_UI)
    }
    animate(x, s * w.current, { ...SPRING_UI, velocity: s * v }).then(fold)
  }
  useEffect(() => {
    if (openProp === undefined || grip.current || phase !== "idle") return
    const target = open ? D : 0
    if (heading.current === target) return
    if (Math.abs(exposed.get() - target) > 0.5) settle(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, D])

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      n === 0 ||
      phase !== "idle" ||
      grip.current ||
      e.button !== 0
    )
      return
    x.stop()
    heading.current = null
    grip.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      grab: null,
      moved: false,
      hist: [],
      touch: e.pointerType === "touch",
    }
    unwatch.current?.()
    unwatch.current = watchWindow(live)
  }
  const move = (e: PointerEvent) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    if (g.grab === null) {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (Math.abs(dx) < HYST || Math.abs(dx) < Math.abs(dy)) return
      g.grab = s * (g.x0 + Math.sign(dx) * HYST) - inv(exposed.get())
      g.moved = true
      suppressClick.current = true
      // Preserve normal link clicks; capture only after a horizontal swipe starts.
      try {
        surface.current?.setPointerCapture(e.pointerId)
      } catch {}
      root.current?.setAttribute("data-dragging", "")
    }
    const ex = map(s * e.clientX - g.grab)
    x.set(s * ex)
    g.hist.push([e.timeStamp, ex])
    if (g.hist.length > 4) g.hist.shift()
    setSpread(canCommit() && ex >= commitPoint())
  }
  const up = (e: PointerEvent) => {
    const g = grip.current
    if (!g || g.id !== e.pointerId) return
    grip.current = null
    unwatch.current?.()
    unwatch.current = null
    root.current?.removeAttribute("data-dragging")
    try {
      surface.current?.releasePointerCapture(e.pointerId)
    } catch {}
    const ex = exposed.get()
    const v = velocityOf(g.hist)
    if (!g.moved) {
      if (open) {
        setOpen(false)
        settle(0)
      }
      return
    }
    if (primary && canCommit() && ex >= commitPoint()) {
      commit(primary, false, v)
      return
    }
    const target =
      Math.abs(v) >= FLICK ? (v > 0 ? D : 0) : ex + project(v) > D / 2 ? D : 0
    setSpread(false)
    setOpen(target === D)
    settle(target, v)
  }
  live.current = { move, up }

  const act = (a: SwipeAction, e: React.MouseEvent<HTMLButtonElement>) => {
    if (phase !== "idle") return
    onAction?.(a)
    if (a.dismiss ?? a === primary) {
      commit(a, e.detail === 0)
      return
    }
    a.onSelect?.()
    if (!closeOnAction) return
    setOpen(false)
    if (e.detail === 0) {
      heading.current = 0
      x.set(0)
    } else settle(0)
  }
  const openNow = () => {
    heading.current = D
    x.set(s * D)
    setOpen(true)
    setSay(`${n} actions revealed`)
    requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLButtonElement>("[data-swipe-actions] button")
        ?.focus()
    })
  }
  const closeNow = () => {
    heading.current = 0
    x.set(0)
    setOpen(false)
  }
  const onToggleKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || phase !== "idle" || n === 0) return
    const openKey = s < 0 ? "ArrowLeft" : "ArrowRight"
    const closeKey = s < 0 ? "ArrowRight" : "ArrowLeft"
    const toggle = e.key === "Enter" || e.key === " "
    if (e.key === openKey || (toggle && !open)) {
      e.preventDefault()
      openNow()
    } else if (e.key === closeKey || e.key === "Escape" || (toggle && open)) {
      e.preventDefault()
      closeNow()
    } else if (
      (e.key === "Delete" || e.key === "Backspace") &&
      open &&
      primary &&
      canCommit()
    ) {
      e.preventDefault()
      commit(primary, true)
    }
  }
  const onToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || phase !== "idle" || n === 0) return
    if (e.detail === 0) {
      if (open) closeNow()
      else openNow()
      return
    }
    setOpen(!open)
    settle(open ? 0 : D)
    if (!open) setSay(`${n} actions revealed`)
  }

  const railId = `${uid}-rail`
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open || phase !== "idle") return
        e.preventDefault()
        e.stopPropagation()
        closeNow()
        root.current
          ?.querySelector<HTMLButtonElement>("[data-swipe-toggle]")
          ?.focus()
      }}
      className={`group relative [height:var(--sr-h)] overflow-hidden [transition:height_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1),margin-bottom_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1),opacity_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1)] data-[disabled]:pointer-events-none data-[phase=collapsing]:mb-0! data-[phase=collapsing]:h-0! data-[phase=collapsing]:opacity-0 data-[disabled]:opacity-55${className ? ` ${className}` : ""}`}
      data-direction={direction}
      data-open={open ? "" : undefined}
      data-phase={phase}
      data-disabled={disabled ? "" : undefined}
      style={
        {
          "--sr-h": `${height}px`,
          "--sr-r": `${radius}px`,
          "--sr-a": `${A}px`,
          "--sr-row": rowColor,
          "--sr-text": textColor,
          "--sr-drawer": drawerColor,
          "--sr-on-drawer": onColor(drawerColor),
          "--sr-action": actionColor,
          "--sr-on-action": onColor(actionColor),
          "--sr-collapse": `${collapseMs}ms`,
          ...style,
        } as CSSProperties
      }
    >
      <div className="relative [height:var(--sr-h)] overflow-hidden [border-radius:var(--sr-r)] [background:var(--sr-row)]">
        <motion.div
          id={railId}
          data-swipe-actions=""
          className="absolute inset-0 [background:var(--sr-drawer)]"
          style={{ transform: railXf }}
          inert={!open || undefined}
          aria-hidden={!open}
        >
          {actions.slice(1).map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="group/action absolute top-0 grid h-full [width:var(--sr-a)] cursor-pointer touch-manipulation place-items-center border-0 p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [font:inherit] after:pointer-events-none after:absolute after:inset-0 after:bg-current after:opacity-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current [@media(hover:hover)_and_(pointer:fine)]:after:[transition:opacity_150ms_ease] [@media(hover:hover)_and_(pointer:fine)]:hover:after:opacity-[0.08]"
              onClick={(e) => act(a, e)}
              style={
                s < 0
                  ? {
                      right: (i + 1) * A,
                      background: a.color ?? drawerColor,
                      color: a.color ? onColor(a.color) : "var(--sr-on-drawer)",
                    }
                  : {
                      left: (i + 1) * A,
                      background: a.color ?? drawerColor,
                      color: a.color ? onColor(a.color) : "var(--sr-on-drawer)",
                    }
              }
            >
              <span className="grid justify-items-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1)] group-active/action:scale-[0.97] motion-reduce:group-active/action:scale-100">
                {a.icon ? <span className="inline-flex">{a.icon}</span> : null}
                <span>{a.label}</span>
              </span>
            </button>
          ))}
          {primary ? (
            <motion.div
              className="absolute top-0 h-full w-full [background:var(--sr-action)] group-data-[direction=left]:[left:calc(100%-var(--sr-a))] group-data-[direction=right]:[right:calc(100%-var(--sr-a))]"
              style={{ transform: blockXf }}
            >
              <motion.button
                type="button"
                className="group/action absolute top-0 grid h-full [width:var(--sr-a)] cursor-pointer touch-manipulation place-items-center border-0 bg-transparent p-0 [color:var(--sr-on-action)] outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [font:inherit] group-data-[direction=left]:start-0 group-data-[direction=right]:end-0 after:pointer-events-none after:absolute after:inset-0 after:bg-current after:opacity-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-current [@media(hover:hover)_and_(pointer:fine)]:after:[transition:opacity_150ms_ease] [@media(hover:hover)_and_(pointer:fine)]:hover:after:opacity-[0.08]"
                style={{ transform: glyphXf }}
                onClick={(e) => act(primary, e)}
              >
                <span className="grid justify-items-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1)] group-active/action:scale-[0.97] motion-reduce:group-active/action:scale-100">
                  <span className="inline-flex">
                    {primary.icon ?? (
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={20}
                        strokeWidth={2}
                      />
                    )}
                  </span>
                  <span>{primary.label}</span>
                </span>
              </motion.button>
            </motion.div>
          ) : null}
        </motion.div>
        <motion.div
          ref={surface}
          className="relative z-[1] flex h-full touch-pan-y items-center gap-3 px-4 [color:var(--sr-text)] [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [background:var(--sr-row)] group-data-[dragging]:select-none group-data-[dragging]:[&_*]:select-none [@media(hover:hover)_and_(pointer:fine)]:cursor-grab [@media(hover:hover)_and_(pointer:fine)]:group-data-[dragging]:cursor-grabbing [@media(pointer:coarse)]:select-none"
          style={{ transform: surfaceXf }}
          onPointerDown={down}
          onPointerDownCapture={() => {
            suppressClick.current = false
          }}
          onClickCapture={(e) => {
            if (!suppressClick.current || e.detail === 0) return
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {children}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ms-auto shrink-0 motion-reduce:transform-none"
            data-swipe-toggle=""
            tabIndex={disabled ? -1 : 0}
            disabled={disabled || n === 0 || phase !== "idle"}
            aria-label={`Actions for ${label}`}
            aria-expanded={open}
            aria-controls={railId}
            aria-keyshortcuts={s < 0 ? "ArrowLeft" : "ArrowRight"}
            onKeyDown={onToggleKey}
            onClick={onToggleClick}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </motion.div>
      </div>
      <span className="sr-only" aria-live="polite">
        {say}
      </span>
    </div>
  )
}

export default SwipeRow
