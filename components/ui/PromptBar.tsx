'use client';

import React, {
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react';
import { ArrowUp, Square } from 'lucide-react';
import {
  BEND_DEFAULTS,
  MetalFx,
  useMetalBend,
  type BendConfig,
  type MetalFxPreset,
  type MetalFxProps
} from 'metal-fx';
import { PromptBarBeam } from '@/components/ui/prompt-bar-beam';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Attachment01Icon,
  Calendar03Icon,
  Cancel01Icon,
  ChartLineData01Icon,
  File02Icon,
  Globe02Icon,
  HelpCircleIcon,
  Mail01Icon,
  Mic01Icon,
  PlusSignIcon,
  SparklesIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
export interface PromptBarSource {
  key: string;
  name: string;
  description?: string;
  icon?: ReactNode | IconSvgElement;
  attach?: boolean;
}

export interface PromptBarCommand {
  key: string;
  name: string;
  description?: string;
}

export interface PromptBarModel {
  key: string;
  name: string;
  tag?: string;
}

export interface PromptBarSendDetail {
  attachments: string[];
  model?: PromptBarModel;
  effort?: string;
}

export interface PromptBarProps {
  placeholder?: string;
  sources?: PromptBarSource[];
  commands?: PromptBarCommand[];
  models?: PromptBarModel[];
  defaultModel?: string;
  efforts?: string[];
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  busy?: boolean;
  onSend?: (text: string, detail: PromptBarSendDetail) => void;
  onStop?: () => void;
  onAttach?: () => string | string[] | void | Promise<string | string[] | void>;
  onDictate?: () => string | void | Promise<string | void>;
  background?: string;
  color?: string;
  menuBackground?: string;
  sparkColor?: string;
  sparkBoost?: number;
  width?: number;
  radius?: number;
  maxRows?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  className?: string;
  /** Liquid-metal rims on source, dictation, and send controls. */
  metal?: boolean;
  metalPreset?: MetalFxPreset;
  metalStrength?: number;
  /** Traveling border beam while the composer is focused or working. */
  borderBeam?: boolean;
}

type Row = {
  key: string;
  name: string;
  description?: string;
  tag?: string;
  icon?: ReactNode | IconSvgElement;
  attach?: boolean;
};
type Token = { kind: 'at' | 'slash'; query: string; start: number };
type Latest = Pick<PromptBarProps, 'onSend' | 'onStop' | 'onAttach' | 'onDictate' | 'onEffortChange'>;
type Spark = {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  life: number;
  span: number;
};

interface SendGlyphProps {
  busy: boolean;
  morphDuration: number;
  squash: number;
  tilt: number;
}

type MetalFrameProps = {
  on: boolean;
  preset: MetalFxPreset;
  theme: 'light' | 'dark';
  strength: number;
  radius: number;
  ringCssPx?: number;
  gooey?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

// Keep the dent local to the compact control, with the package's spring physics.
// Per-instance config avoids changing other metal surfaces or the shared shader.
const GOOEY_BEND: BendConfig = {
  ...BEND_DEFAULTS,
  strength: 0.9,
  reach: 18,
  blob: 10,
  liquidBlob: 8,
  maxDisp: 6,
  liquid: 6,
  liquidReach: 5
};
const STATIC_BEND: BendConfig = { ...GOOEY_BEND, enabled: false };

function GooeyMetalFx(props: MetalFxProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef('mouse');
  const interaction = useRef<{
    finePointer: MediaQueryList;
    reducedMotion: MediaQueryList;
    hasCanvas: boolean;
  } | null>(null);

  useEffect(() => {
    interaction.current = {
      finePointer: window.matchMedia('(hover: hover) and (pointer: fine)'),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      hasCanvas: Boolean(frameRef.current?.querySelector('canvas.metal-fx-canvas'))
    };
    const trackPointer = (event: globalThis.PointerEvent) => {
      pointerType.current = event.pointerType;
    };
    document.addEventListener('pointermove', trackPointer, { passive: true });
    document.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => {
      interaction.current = null;
      document.removeEventListener('pointermove', trackPointer);
      document.removeEventListener('pointerdown', trackPointer);
    };
  }, []);

  const getBendConfig = useCallback(() => {
    const environment = interaction.current;
    const enabled =
      environment?.hasCanvas &&
      pointerType.current === 'mouse' &&
      !document.hidden &&
      environment.finePointer.matches &&
      !environment.reducedMotion.matches;
    return enabled ? GOOEY_BEND : STATIC_BEND;
  }, []);
  useMetalBend(frameRef, getBendConfig);

  return <MetalFx ref={frameRef} {...props} />;
}

/**
 * Kept at module scope so the wrapper keeps a stable component identity across
 * parent renders. MetalFx renders different markup on the server than in a
 * WebGL2 browser, so it only appears once `on` flips after mount.
 */
function MetalFrame({
  on,
  preset,
  theme,
  strength,
  radius,
  ringCssPx = 1.5,
  gooey = false,
  paused = false,
  className,
  style,
  children
}: MetalFrameProps) {
  if (!on) return <>{children}</>;
  const Frame = gooey ? GooeyMetalFx : MetalFx;
  return (
    <Frame
      preset={preset}
      theme={theme}
      strength={strength}
      borderRadius={radius}
      ringCssPx={ringCssPx}
      paused={paused}
      innerShadow={gooey || undefined}
      className={className}
      style={style}
    >
      {children}
    </Frame>
  );
}

type MetalControlProps = Pick<MetalFrameProps, 'on' | 'preset' | 'theme' | 'strength' | 'children'> & {
  active?: boolean;
  emphasized?: boolean;
  gooey?: boolean;
  className?: string;
};

/** A stable shell preserves button focus while the metal responds to state. */
function MetalControl({
  on,
  preset,
  theme,
  strength,
  active = false,
  emphasized = false,
  gooey = false,
  className,
  children
}: MetalControlProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const engaged = active || emphasized || hovered || focused;

  return (
    <div
      className={cn('pb-control inline-flex min-w-0 flex-none rounded-lg', className)}
      data-active={active ? '' : undefined}
      data-emphasis={emphasized ? '' : undefined}
      data-gooey={on && gooey ? '' : undefined}
      onPointerEnter={e => setHovered(e.pointerType === 'mouse')}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <MetalFrame
        on={on}
        preset={preset}
        theme={theme}
        strength={strength * (engaged ? 1 : 0.6)}
        radius={10}
        ringCssPx={gooey ? 2 : 1.5}
        gooey={gooey}
        paused={gooey && !engaged}
        className="min-w-0 w-full"
        style={{ display: 'flex', background: 'var(--pb-control-bg)', color: 'inherit' }}
      >
        {children}
      </MetalFrame>
    </div>
  );
}

const CONTROL_BUTTON_CLASS =
  'inline-flex h-8 min-w-0 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[13px] font-medium text-inherit outline-none select-none [font-family:inherit] [-webkit-tap-highlight-color:transparent] [@media(pointer:coarse)]:h-9';
const ICON_BUTTON_CLASS =
  'inline-grid size-8 flex-none cursor-pointer touch-manipulation place-items-center rounded-lg border-0 bg-transparent p-0 text-inherit outline-none select-none [-webkit-tap-highlight-color:transparent] [@media(pointer:coarse)]:size-9';

const LINE = 22;
const EDGE = 11;

const DEFAULT_SOURCES: PromptBarSource[] = [
  {
    key: 'files',
    name: 'Photos & files',
    description: 'Upload from this device',
    icon: Attachment01Icon,
    attach: true
  },
  { key: 'web', name: 'Web search', description: 'Live results', icon: Globe02Icon },
  { key: 'sales', name: 'Sales data', description: 'Revenue and churn', icon: ChartLineData01Icon },
  { key: 'docs', name: 'Documents', description: 'Specs, notes, briefs', icon: File02Icon },
  { key: 'mail', name: 'Mail', description: 'Read and draft mail', icon: Mail01Icon },
  { key: 'calendar', name: 'Calendar', description: 'Events and availability', icon: Calendar03Icon }
];
const DEFAULT_COMMANDS: PromptBarCommand[] = [
  { key: 'summarize', name: '/summarize', description: 'Digest the thread so far' },
  { key: 'compare', name: '/compare', description: 'Two options side by side' },
  { key: 'draft', name: '/draft', description: 'Write a first version' },
  { key: 'explain', name: '/explain', description: 'A plain-language walkthrough' },
  { key: 'tasks', name: '/tasks', description: 'Turn this into a to-do list' }
];
const DEFAULT_MODELS: PromptBarModel[] = [
  { key: 'nova-3', name: 'Nova 3', tag: 'Flagship' },
  { key: 'nova-mini', name: 'Nova Mini', tag: 'Fast' },
  { key: 'nova-2', name: 'Nova 2', tag: 'Legacy' }
];
const DEFAULT_EFFORTS = ['Low', 'Medium', 'High', 'Extra', 'Max'];

const parseToken = (draft: string): Token | null => {
  const m = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!m) return null;
  return { kind: m[2] === '@' ? 'at' : 'slash', query: m[3].toLowerCase(), start: m.index + m[1].length };
};

const renderIcon = (icon: ReactNode | IconSvgElement, size: number) =>
  isValidElement(icon) ? icon : <HugeiconsIcon icon={icon as IconSvgElement} size={size} strokeWidth={1.8} />;

function subscribeToReducedMotion(onChange: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', onChange);
  return () => preference.removeEventListener('change', onChange);
}

const getReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const getServerReducedMotion = () => true;

function usePromptReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, getServerReducedMotion);
}

function SendGlyph({ busy, morphDuration, squash, tilt }: SendGlyphProps) {
  return (
    <span
      className="pb-send-glyph inline-grid size-5 place-items-center"
      data-busy={busy ? '' : undefined}
      aria-hidden="true"
      style={
        {
          '--pb-glyph-duration': `${morphDuration}ms`,
          '--pb-glyph-squash': Math.max(0.9, 1 - squash),
          '--pb-glyph-tilt': `${tilt}deg`
        } as CSSProperties
      }
    >
      <ArrowUp className="pb-send-arrow col-start-1 row-start-1" size={20} strokeWidth={1.5} />
      <Square className="pb-send-stop col-start-1 row-start-1" size={14} fill="currentColor" strokeWidth={0} />
    </span>
  );
}

const STYLE = `
@keyframes prompt-bar-pop { from { opacity: 0; transform: translateY(4px) scale(0.98); } }
@keyframes prompt-bar-eq { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
.pb-control {
  --pb-control-bg: color-mix(in srgb, var(--pb-ink) 4%, var(--pb-bg));
  background: var(--pb-control-bg);
  color: color-mix(in srgb, var(--pb-ink) 78%, var(--pb-bg));
  transition: background-color 150ms ease, color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
}
.pb-control[data-gooey] { background: transparent; }
.pb-control[data-active] {
  --pb-control-bg: color-mix(in srgb, var(--pb-ink) 12%, var(--pb-bg));
  color: var(--pb-ink);
}
.pb-control[data-emphasis] {
  --pb-control-bg: color-mix(in srgb, var(--pb-spark) 16%, var(--pb-bg));
  color: var(--pb-ink);
}
.pb-control:has(button:focus-visible), .pb-send-frame:has(button:focus-visible) {
  outline: 2px solid var(--ring, var(--pb-ink));
  outline-offset: 3px;
}
.pb-control:has(button:active) { transform: scale(var(--pb-press)); }
.pb-surface[data-edge] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pb-ink) 12%, transparent);
}
.pb-send-frame {
  --pb-send-bg: var(--foreground);
  --pb-send-ink: var(--background);
  --pb-send-fill: color-mix(in srgb, var(--pb-send-bg) 74%, var(--pb-bg));
  transition: transform 160ms var(--ease-out);
}
.pb-send-frame[data-armed] { --pb-send-fill: var(--pb-send-bg); }
:where(.dark) .pb-send-frame {
  --pb-send-bg: var(--background);
  --pb-send-ink: var(--foreground);
}
.pb-send-frame[data-pressed] { transform: scale(var(--pb-press)); }
.pb-send-arrow, .pb-send-stop {
  transition: opacity var(--pb-glyph-duration) ease, transform var(--pb-glyph-duration) var(--ease-in-out);
}
.pb-send-stop, .pb-send-glyph[data-busy] .pb-send-arrow {
  opacity: 0;
  transform: rotate(var(--pb-glyph-tilt)) scale(var(--pb-glyph-squash));
}
.pb-send-glyph[data-busy] .pb-send-stop { opacity: 1; transform: none; }
@media (hover: hover) and (pointer: fine) {
  .pb-control:hover {
    --pb-control-bg: color-mix(in srgb, var(--pb-ink) 10%, var(--pb-bg));
    color: var(--pb-ink);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pb-control:has(button:active), .pb-send-frame[data-pressed] { transform: none; }
  .pb-send-arrow, .pb-send-stop { transition: none; transform: none !important; }
  .pb-listening > i { animation: none !important; }
}
`;

const PromptBar: React.FC<PromptBarProps> = ({
  placeholder = 'Ask anything',
  sources = DEFAULT_SOURCES,
  commands = DEFAULT_COMMANDS,
  models = DEFAULT_MODELS,
  defaultModel = '',
  efforts = DEFAULT_EFFORTS,
  defaultEffort = '',
  onEffortChange,
  busy = false,
  onSend,
  onStop,
  onAttach,
  onDictate,
  background = '#27272a',
  color = '#f5f5f5',
  menuBackground = '#323236',
  sparkColor = '#b39dff',
  sparkBoost = 1,
  width = 400,
  radius = 16,
  maxRows = 5,
  morphDuration = 240,
  squash = 0.12,
  tilt = 8,
  pressScale = 0.96,
  className = '',
  metal = true,
  metalPreset = 'chromatic',
  metalStrength = 1,
  borderBeam = true
}) => {
  const reduce = usePromptReducedMotion();
  const { resolvedTheme } = useTheme();
  const [metalReady, setMetalReady] = useState(false);
  useEffect(() => setMetalReady(true), []);
  const metalOn = metal && metalReady && !reduce;
  const metalTheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const controlMetal = { on: metalOn, preset: metalPreset, theme: metalTheme, strength: metalStrength } as const;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const typing = useRef({ energy: 0, strokes: 0 });
  const boost = useRef(sparkBoost);
  boost.current = sparkBoost;
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastOpen = useRef<string | null>(null);
  const dictation = useRef(0);
  const latest = useRef<Latest>({});
  latest.current = { onSend, onStop, onAttach, onDictate, onEffortChange };

  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [modelKey, setModelKey] = useState(defaultModel);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [effortIndex, setEffortIndex] = useState(() => {
    const i = efforts.indexOf(defaultEffort);
    return i >= 0 ? i : Math.max(0, Math.floor((efforts.length - 1) / 2));
  });
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  const model = models.find(m => m.key === modelKey) ?? models[0];
  const token = dismissed ? null : parseToken(draft);
  const open = plusOpen ? 'at' : (token?.kind ?? (modelOpen ? 'model' : effortOpen ? 'effort' : null));
  const query = plusOpen ? '' : (token?.query ?? '');
  const list = useMemo<Row[]>(() => {
    if (open === 'at') return sources.filter(s => s.name.toLowerCase().includes(query));
    if (open === 'slash') return commands.filter(c => c.name.replace(/^\//, '').toLowerCase().startsWith(query));
    if (open === 'model') return models;
    return [];
  }, [open, query, sources, commands, models]);
  const cursor = Math.min(active, Math.max(0, list.length - 1));
  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const armed = busy || canSend;
  const level = efforts[effortIndex] ?? '';
  const maxed = efforts.length > 1 && effortIndex === efforts.length - 1;

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });
  const closeMenus = useCallback(() => {
    setPlusOpen(false);
    setModelOpen(false);
    setEffortOpen(false);
  }, []);

  useLayoutEffect(() => {
    const glow = glowRef.current;
    if (!glow || !open) return;
    const row = rowRefs.current[cursor];
    if (!row) {
      glow.style.opacity = '0';
      return;
    }
    const fresh = lastOpen.current !== open;
    lastOpen.current = open;
    if (fresh) glow.style.transition = 'none';
    glow.style.top = `${row.offsetTop}px`;
    glow.style.height = `${row.offsetHeight}px`;
    glow.style.opacity = '1';
    if (fresh) {
      void glow.offsetHeight;
      glow.style.transition = '';
    }
  }, [open, cursor, list]);
  useEffect(() => {
    if (!open) lastOpen.current = null;
  }, [open]);

  useEffect(() => {
    if (!plusOpen && !modelOpen && !effortOpen) return undefined;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeMenus();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [plusOpen, modelOpen, effortOpen, closeMenus]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const max = LINE * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [draft, maxRows]);

  useEffect(
    () => () => {
      dictation.current += 1;
    },
    []
  );

  useEffect(() => {
    const canvas = sparkRef.current;
    if (!maxed || reduce || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    typing.current.strokes = 0;
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let due = 0;
    let speed = 1;
    let pulse = 0;
    const parts: Spark[] = [];
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (burst: boolean) => {
      parts.push({
        x: Math.random() * w,
        y: burst ? h * (0.2 + Math.random() * 0.8) : h + 3,
        r: 0.9 + Math.random() * 1.1,
        vy: -(7 + Math.random() * 9),
        sway: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
        life: burst ? Math.random() * 1.2 : 0,
        span: 2.4 + Math.random() * 2.4
      });
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const typed = typing.current;
      const gain = boost.current;
      typed.energy *= Math.exp(-dt / 0.8);
      pulse *= Math.exp(-dt / 0.16);
      if (typed.strokes > 0) {
        typed.strokes = 0;
        if (gain > 0) pulse = 1;
      }
      const energy = typed.energy * gain;
      speed += (1 + energy * 6 - speed) * (1 - Math.exp(-dt / 0.15));
      due += dt;
      while (due > 0.14) {
        due -= 0.14;
        if (parts.length < 30) spawn(false);
      }
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = sparkColor;
      ctx.shadowColor = sparkColor;
      ctx.shadowBlur = 6 + energy * 10 + pulse * 6;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.span) {
          parts.splice(i, 1);
          continue;
        }
        const k = p.life / p.span;
        const twinkle = 0.7 + 0.3 * Math.sin((now / 160) * (1 + energy) + p.phase);
        p.y += p.vy * dt * speed;
        if (p.y < -4) {
          p.y = h + 3;
          p.x = Math.random() * w;
        }
        const edge = Math.min(1, Math.max(0, p.y / 14), Math.max(0, (h - p.y) / 14));
        ctx.globalAlpha = Math.min(1, Math.sin(k * Math.PI) * (0.9 + energy * 0.25) * twinkle) * edge;
        ctx.beginPath();
        ctx.arc(
          p.x + Math.sin((now / 900) * (1 + energy * 0.8) + p.phase) * p.sway,
          p.y,
          p.r * twinkle * (1 + energy * 0.35),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    resize();
    for (let i = 0; i < 26; i += 1) spawn(true);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.clearRect(0, 0, w, h);
    };
  }, [maxed, reduce, sparkColor]);

  const setEffort = (i: number) => {
    const next = Math.max(0, Math.min(efforts.length - 1, i));
    if (next === effortIndex) return;
    setEffortIndex(next);
    latest.current.onEffortChange?.(efforts[next]);
  };
  const effortFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const k = (e.clientX - rect.left - EDGE) / Math.max(1, rect.width - 2 * EDGE);
    setEffort(Math.round(k * (efforts.length - 1)));
  };
  const onEffortKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (step) {
      e.preventDefault();
      setEffort(effortIndex + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setEffort(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setEffort(efforts.length - 1);
    } else if (e.key === 'Escape') {
      setEffortOpen(false);
      focusInput();
    }
  };
  const stepAt = (i: number) => `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${i / Math.max(1, efforts.length - 1)})`;
  const fillAt = (i: number) => (i === efforts.length - 1 ? '100%' : `calc(${stepAt(i)} + 7px)`);

  const pick = (row: Row) => {
    if (open === 'model') {
      setModelKey(row.key);
      setModelOpen(false);
      focusInput();
      return;
    }
    const head = token ? draft.slice(0, token.start) : draft;
    if (row.attach) {
      setDraft(head);
      Promise.resolve(latest.current.onAttach?.()).then(files => {
        if (!files) return;
        setAttachments(a => [...a, ...(Array.isArray(files) ? files : [files])]);
      });
    } else if (open === 'at') {
      setDraft(`${head}@${row.name} `);
    } else {
      setDraft(`${head}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    focusInput();
  };

  const send = () => {
    if (!canSend || busy) return;
    latest.current.onSend?.(draft.trim(), { attachments, model, effort: level });
    setDraft('');
    setAttachments([]);
    setDismissed(false);
    closeMenus();
    focusInput();
  };

  const toggleListen = () => {
    if (listening) {
      dictation.current += 1;
      setListening(false);
      return;
    }
    const seq = ++dictation.current;
    setListening(true);
    Promise.resolve(latest.current.onDictate?.()).then(
      text => {
        if (seq !== dictation.current) return;
        setListening(false);
        if (text) setDraft(d => (d.trim() ? `${d.trimEnd()} ${text}` : text));
        focusInput();
      },
      () => {
        if (seq === dictation.current) setListening(false);
      }
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && list.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((cursor + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        pick(list[cursor]);
        return;
      }
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setDismissed(true);
        closeMenus();
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !armed) return;
    setPressed(true);
  };
  const up = () => setPressed(false);

  return (
    <div
      ref={rootRef}
      className={`group relative text-[14px] leading-[22px] [width:min(var(--pb-w),100%)] [color:var(--pb-ink)]${className ? ` ${className}` : ''}`}
      data-busy={busy ? '' : undefined}
      data-max={maxed ? '' : undefined}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      style={
        {
          '--pb-bg': background,
          '--pb-ink': color,
          '--pb-menu': menuBackground,
          '--pb-w': `${width}px`,
          '--pb-radius': `${radius}px`,
          '--pb-spark': sparkColor,
          '--pb-press': pressScale
        } as CSSProperties
      }
    >
      <style>{STYLE}</style>
      {open ? (
        <div
          className="absolute inset-x-0 bottom-[calc(100%+8px)] z-[2] origin-bottom rounded-xl p-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.08)] [animation:prompt-bar-pop_180ms_cubic-bezier(0.23,1,0.32,1)_both] [background:var(--pb-menu)] data-[kind=model]:end-auto data-[kind=model]:w-[200px] data-[kind=model]:origin-bottom-start data-[kind=effort]:end-auto data-[kind=effort]:w-[248px] data-[kind=effort]:origin-bottom-start data-[kind=effort]:px-3.5 data-[kind=effort]:pt-3 data-[kind=effort]:pb-3.5 motion-reduce:[animation:none]"
          role={open === 'effort' ? 'dialog' : 'listbox'}
          aria-label={
            open === 'at' ? 'Sources' : open === 'slash' ? 'Commands' : open === 'model' ? 'Models' : 'Effort'
          }
          data-kind={open}
        >
          {open === 'effort' ? (
            <>
              <div className="flex items-center gap-2 text-[13px] leading-[18px]">
                <span className="[color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]">Effort</span>
                <span className="font-medium">{level}</span>
                <span
                  className="ms-auto inline-flex [color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]"
                  title="Higher effort thinks longer before answering"
                >
                  <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.8} />
                </span>
              </div>
              <div className="mt-3 flex justify-between text-[12px] leading-4 [color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]">
                <span>Faster</span>
                <span>Smarter</span>
              </div>
              <div
                className="relative mt-2 h-[22px] cursor-pointer touch-none rounded-[11px] outline-none select-none [background:color-mix(in_srgb,var(--pb-ink)_8%,transparent)]"
                role="slider"
                tabIndex={0}
                aria-label="Effort"
                aria-valuemin={0}
                aria-valuemax={efforts.length - 1}
                aria-valuenow={effortIndex}
                aria-valuetext={level}
                style={
                  { '--pb-effort-x': stepAt(effortIndex), '--pb-effort-fill': fillAt(effortIndex) } as CSSProperties
                }
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {}
                  e.currentTarget.focus({ preventScroll: true });
                  effortFromPointer(e);
                }}
                onPointerMove={e => {
                  if (e.buttons & 1) effortFromPointer(e);
                }}
                onKeyDown={onEffortKey}
              >
                <span className="absolute inset-y-0 start-0 rounded-[11px] [width:var(--pb-effort-fill)] [background:color-mix(in_srgb,var(--pb-ink)_18%,transparent)] [transition:width_220ms_cubic-bezier(0.23,1,0.32,1),background-color_300ms_ease] group-data-[max]:[background:color-mix(in_srgb,var(--pb-spark)_35%,transparent)] motion-reduce:[transition:background-color_300ms_ease]" />
                {efforts.map((label, i) => (
                  <i
                    key={label}
                    className="absolute top-1/2 -mt-0.5 -ms-0.5 h-1 w-1 rounded-full [background:color-mix(in_srgb,var(--pb-ink)_30%,transparent)]"
                    style={{ left: stepAt(i) }}
                  />
                ))}
                <span className="absolute -top-[3px] -ms-[7px] h-7 w-3.5 rounded-[7px] shadow-[0_2px_6px_rgba(0,0,0,0.25)] [left:var(--pb-effort-x)] [background:var(--pb-ink)] [transition:left_220ms_cubic-bezier(0.23,1,0.32,1),background-color_300ms_ease] group-data-[max]:[background:var(--pb-spark)] motion-reduce:[transition:background-color_300ms_ease]" />
              </div>
            </>
          ) : (
            <>
              <span
                ref={glowRef}
                className="pointer-events-none absolute inset-x-1 rounded-lg opacity-0 [background:color-mix(in_srgb,var(--pb-ink)_8%,transparent)] [transition:top_220ms_cubic-bezier(0.23,1,0.32,1),height_220ms_cubic-bezier(0.23,1,0.32,1),opacity_150ms_ease] motion-reduce:[transition:opacity_150ms_ease]"
                aria-hidden="true"
              />
              {list.map((row, i) => (
                <button
                  key={row.key}
                  ref={el => {
                    rowRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  className="relative z-[1] flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 text-start text-inherit outline-none [font:inherit] [-webkit-tap-highlight-color:transparent]"
                  onMouseDown={e => e.preventDefault()}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(row)}
                >
                  {open === 'at' ? (
                    <span className="inline-flex w-5 flex-none justify-center [color:color-mix(in_srgb,var(--pb-ink)_70%,transparent)]">
                      {renderIcon(row.icon, 15)}
                    </span>
                  ) : null}
                  <span className="flex-none text-[13px] font-medium">{row.name}</span>
                  {row.description ? (
                    <span className="min-w-0 flex-auto truncate text-[12px] [color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]">
                      {row.description}
                    </span>
                  ) : null}
                  {open === 'model' ? (
                    <>
                      <span className="ms-auto flex-none text-[11px] [color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]">
                        {row.tag}
                      </span>
                      <span
                        className="inline-flex w-4 flex-none justify-center opacity-0 data-[on]:opacity-100"
                        data-on={row.key === model?.key ? '' : undefined}
                      >
                        <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
                      </span>
                    </>
                  ) : null}
                </button>
              ))}
              {list.length === 0 ? (
                <div className="flex h-9 items-center px-2 text-[12px] [color:color-mix(in_srgb,var(--pb-ink)_55%,transparent)]">
                  No matches for “{query}”
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <MetalFrame
        on={metalOn && !borderBeam}
        preset={metalPreset}
        theme={metalTheme}
        strength={metalStrength}
        radius={radius}
        ringCssPx={2.5}
        className="w-full"
        style={{ display: 'flex', background: 'var(--pb-bg)', color: 'var(--pb-ink)' }}
      >
        <div
          className="pb-surface relative isolate flex w-full cursor-text flex-col gap-2 p-3 [background:var(--pb-bg)] [border-radius:var(--pb-radius)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:opacity-0 before:content-[''] before:[background:radial-gradient(140%_120%_at_0%_100%,color-mix(in_srgb,var(--pb-spark)_26%,transparent),transparent_62%)] before:[transition:opacity_500ms_ease] data-[max]:before:opacity-100"
          role="presentation"
          data-edge={borderBeam && !metalReady ? '' : undefined}
          data-max={maxed ? '' : undefined}
          onPointerDown={e => {
            if (e.target === e.currentTarget || e.target === inputRef.current) closeMenus();
          }}
          onClick={focusInput}
        >
          {borderBeam && metalReady ? (
            <PromptBarBeam
              active={focused || Boolean(open) || busy || listening}
              busy={busy}
              radius={radius}
              theme={metalTheme}
            />
          ) : null}
          <canvas
            ref={sparkRef}
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full rounded-[inherit]"
            aria-hidden="true"
          />
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((file, i) => (
                <span
                  key={`${file}-${i}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg pe-1 ps-2 text-[12px] [animation:prompt-bar-pop_200ms_cubic-bezier(0.23,1,0.32,1)_both] [background:color-mix(in_srgb,var(--pb-ink)_8%,transparent)] motion-reduce:[animation:none]"
                >
                  <HugeiconsIcon icon={File02Icon} size={12} strokeWidth={2} />
                  <span className="max-w-[144px] truncate">{file}</span>
                  <span className="pb-control inline-flex flex-none rounded-md">
                    <button
                      type="button"
                      className="inline-grid size-6 cursor-pointer touch-manipulation place-items-center rounded-md border-0 bg-transparent p-0 text-inherit outline-none"
                      aria-label={`Remove ${file}`}
                      onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                </span>
              ))}
            </div>
          ) : null}

          <textarea
            ref={inputRef}
            className="block w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-[22px] text-inherit outline-none [font:inherit] [overflow-wrap:anywhere] placeholder:[color:color-mix(in_srgb,var(--pb-ink)_45%,transparent)] [@media(pointer:coarse)]:text-[16px]"
            rows={1}
            value={draft}
            placeholder={listening ? 'Listening…' : placeholder}
            aria-label="Prompt"
            onChange={e => {
              setDraft(e.target.value);
              typing.current.energy = Math.min(1.6, typing.current.energy + 0.22);
              typing.current.strokes = Math.min(4, typing.current.strokes + 1);
              setDismissed(false);
              closeMenus();
              setActive(0);
            }}
            onFocus={closeMenus}
            onKeyDown={onKeyDown}
          />

          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            <MetalControl {...controlMetal} active={open === 'at'} gooey>
              <button
                type="button"
                className={ICON_BUTTON_CLASS}
                aria-label="Add files and sources"
                aria-expanded={open === 'at'}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  focusInput();
                  setModelOpen(false);
                  setEffortOpen(false);
                  setActive(0);
                  setPlusOpen(v => !v);
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={2} />
              </button>
            </MetalControl>
            {models.length > 0 ? (
              <div
                className="pb-control inline-flex min-w-0 flex-none shrink rounded-lg"
                data-active={modelOpen ? '' : undefined}
              >
                <button
                  type="button"
                  className={CONTROL_BUTTON_CLASS}
                  aria-label="Choose model"
                  aria-expanded={modelOpen}
                  title={model.name}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    focusInput();
                    setPlusOpen(false);
                    setEffortOpen(false);
                    setActive(Math.max(0, models.indexOf(model)));
                    setModelOpen(v => !v);
                  }}
                >
                  <span className="max-w-32 truncate">{model.name}</span>
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.4} className="flex-none" />
                </button>
              </div>
            ) : null}
            {efforts.length > 0 ? (
              <div
                className="pb-control inline-flex min-w-0 flex-none shrink rounded-lg"
                data-active={effortOpen ? '' : undefined}
                data-emphasis={maxed ? '' : undefined}
              >
                <button
                  type="button"
                  className={CONTROL_BUTTON_CLASS}
                  aria-label="Choose effort"
                  aria-expanded={effortOpen}
                  title={level}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    focusInput();
                    setPlusOpen(false);
                    setModelOpen(false);
                    setEffortOpen(v => !v);
                  }}
                >
                  <HugeiconsIcon icon={SparklesIcon} size={14} strokeWidth={2} className="flex-none" />
                  <span className="max-w-24 truncate">{level}</span>
                </button>
              </div>
            ) : null}
            <span className="flex-auto" aria-hidden="true" />
            {onDictate ? (
              <MetalControl {...controlMetal} active={listening} emphasized={listening}>
                <button
                  type="button"
                  className={ICON_BUTTON_CLASS}
                  aria-label={listening ? 'Stop dictation' : 'Dictate'}
                  aria-pressed={listening}
                  data-on={listening ? '' : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onClick={toggleListen}
                >
                  {listening ? (
                    <span
                      className="pb-listening flex h-3.5 items-center gap-[2.5px] [&>i]:block [&>i]:h-full [&>i]:w-[2.5px] [&>i]:origin-center [&>i]:rounded-full [&>i]:bg-current [&>i]:[animation:prompt-bar-eq_900ms_ease-in-out_infinite] [&>i:nth-child(2)]:[animation-delay:150ms] [&>i:nth-child(3)]:[animation-delay:300ms]"
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <HugeiconsIcon icon={Mic01Icon} size={17} strokeWidth={2} />
                  )}
                </button>
              </MetalControl>
            ) : null}
            <div
              className="pb-send-frame inline-flex flex-none rounded-lg"
              data-armed={armed ? '' : undefined}
              data-pressed={pressed ? '' : undefined}
            >
              <MetalFrame
                on={metalOn}
                preset={metalPreset}
                theme={metalTheme}
                strength={metalStrength * (armed ? 1 : 0.35)}
                // `rounded-lg` resolves to 10px through the shadcn radius scale.
                radius={10}
                ringCssPx={2}
                gooey
                paused={!armed}
                className="flex-none"
                style={{
                  display: 'flex',
                  background: 'var(--pb-send-fill)',
                  color: 'var(--pb-send-ink)'
                }}
              >
                <button
                  type="button"
                  className="relative inline-grid size-8 flex-none cursor-pointer touch-manipulation place-items-center rounded-lg border-0 p-0 outline-none select-none [background:var(--pb-send-fill)] [color:var(--pb-send-ink)] [font:inherit] [-webkit-tap-highlight-color:transparent] [transition:background-color_200ms_ease,opacity_200ms_ease] disabled:cursor-default disabled:[&>.pb-send-glyph]:opacity-55 data-[metal]:bg-transparent [@media(pointer:coarse)]:size-9"
                  disabled={!armed}
                  aria-label={busy ? 'Stop' : 'Send'}
                  data-armed={armed ? '' : undefined}
                  data-metal={metalOn ? '' : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onPointerDown={down}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onPointerLeave={up}
                  onClick={() => {
                    if (busy) latest.current.onStop?.();
                    else send();
                  }}
                >
                  <SendGlyph busy={busy} morphDuration={morphDuration} squash={squash} tilt={tilt} />
                </button>
              </MetalFrame>
            </div>
          </div>
        </div>
      </MetalFrame>
    </div>
  );
};

export default PromptBar;
