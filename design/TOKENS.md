# InstaGrad design tokens

Derived from the five approved dashboard references on 2026-11-01. The core
shadcn OKLCH palette in `app/globals.css` remains canonical; the tokens below
extend it with workspace-specific surfaces and layout values.

## Direction

InstaGrad should feel like a calm research instrument: a dense library rail on
the left, a generous analysis canvas on the right, and lime used only to show
where the system is active. The memorable moment is the living document signal
(particle wordmark, folder state, or thinking orb); surrounding UI stays quiet.

### Core palette

| Name | Approximate reference | Semantic token |
| --- | --- | --- |
| Paper | `#ffffff` | `--background` / `--surface` |
| Carbon | `#252525` | `--foreground` |
| Rail black | `#0b0b0b` | `--sidebar` in dark mode |
| Signal lime | `#b8f42f` | `--primary` |
| Smoke | `#f5f5f2` | `--muted` / `--surface-subtle` |
| Analysis cyan | `#55cfe7` | `--chart-2` |

Use semantic utilities (`bg-primary`, `bg-surface`, `text-foreground`) rather
than these approximations. Status and source colors come from the chart scale.

## Typography

- Brand/editorial: Noto Serif via `font-serif` and `font-heading`. Use for the
  wordmark, landing headline, analysis titles, and short interpretive copy.
- Interface: Geist via `font-sans`. Use for navigation, controls, metadata,
  message chrome, and dense lists.
- Technical: Geist Mono via `font-mono`. Reserve for file sizes, timestamps,
  step identifiers, and machine output.
- Hero: responsive 3.5rem–7.5rem, tight leading (0.88–0.96).
- Page title: 2rem–3.5rem, leading around 1.
- Body: 0.9375rem–1.0625rem, 1.5–1.7 line height, maximum 72 characters.
- Interface labels: 0.75rem–0.875rem, sentence case, never tracked all caps.

## Shape, spacing, and shadow

- Base radius: `--radius: 0.625rem`; interactive panels use `--radius-panel`.
- Compact controls use `--radius-control`; large prompt surfaces use
  `--radius-stage`.
- Spacing follows a 4px base. Primary rhythm: 8, 12, 16, 24, 32, 48, 64.
- Use `--shadow-panel` only for floating prompt/dialog surfaces, `--shadow-card`
  for seated content cards, and `--shadow-soft` for the landing preview frame.
  Flat work surfaces use borders, not shadow.
- Motion curves are `--ease-out`, `--ease-in-out`, and `--ease-drawer`.
  Interactive UI remains below 300ms; long motion is limited to explanatory
  landing visuals and purposeful system-state animations.
- Source and send controls carry 2px liquid-metal rims supplied by `metal-fx`
  and bounded vector deformation through `useMetalBend` on fine mouse pointers.
  Dictation retains a 1.5px metal rim; model and effort choices stay flat.
  Metal follows the app theme and is disabled under reduced motion. Controls
  strengthen on hover, focus, and activation; maximum effort and dictation
  retain a semantic tinted fill. Toolbar controls are 32px, increasing to 36px
  on coarse pointers. The send arrow is a thin Lucide glyph with pale ink on a
  dark semantic fill in both themes; its fill variable survives bend cleanup.
- The prompt surface also uses `border-beam` for a contained primary-to-chart
  2px traveling arc while focused, showing a menu, dictating, or working. It
  leaves a neutral static hairline at rest and under reduced motion, pauses when
  hidden or offscreen, and never covers text or intercepts input. `borderBeam={false}`
  disables this layer and restores the 2.5px surface metal rim when metal is
  enabled. Never stack both perimeter effects. Keep surrounding cards flat.

## Layout grid

- Desktop app frame: full-bleed and viewport-filling with no outer gutter,
  rounding, or frame shadow; the sidebar border is the only frame edge.
- Dashboard content caps at 90rem so wide screens gain working room without
  stretching the reading lane.
- Sidebar: `--sidebar-width` (272px), with 16px internal padding.
- Main canvas: flexible column with a 64–76ch reading lane and optional
  280–340px context rail.
- Conversation, composer, and loading lanes cap at 56rem (896px), with streaming
  analysis capped at 50rem; prose retains its character-based reading limits.
- Landing content: `--content-max` (1180px), left aligned except for the hero
  wordmark and its prompt stage.
- Mobile: one canvas, 16px gutters, sidebar becomes an accessible sheet.

```text
Landing
┌─────────────────────────────────────────────────────────────┐
│ quiet nav                                                   │
│             living “InstaGrad” wordmark                     │
│        concise promise + document prompt                    │
│   ───────────── product proof as one wide scene ─────────   │
└─────────────────────────────────────────────────────────────┘

Workspace
┌──────────────┬──────────────────────────────────────────────┐
│ library rail │ header / context                             │
│ search       ├──────────────────────────────────────────────┤
│ active item  │                                              │
│ collections  │ analysis canvas / conversation               │
│              │                                              │
│ account      │ anchored prompt                              │
└──────────────┴──────────────────────────────────────────────┘
```

## Theme structure

- Light: paper canvas, white raised surfaces, cool neutral rail, dark ink.
- Lightfall regions add pale lime and cyan gradients through
  `--ambient-primary` and `--ambient-secondary`, derived from `--primary` and
  `--chart-2`. The extra washes are transparent in dark mode.
- Dark: carbon canvas, near-black rail, softly lifted panels, pale ink.
- Lime identifies current, active, ready, or confirmed states. The Lightfall
  background also uses the approved pale lime and cyan atmosphere; keep other
  content surfaces neutral.
- Cyan/blue chart tokens identify sources and analysis branches.
- The background grid is low contrast and fades before it reaches reading text.

## Component rules

- `Lightfall` is a single background instance per route, below content, with a
  static token-based gradient fallback. Pause it when hidden.
- `ParticleText` is the landing focal point only; reduced motion gets static
  Noto Serif text.
- `ClickSpark` is feedback for pointer activation only and is disabled for
  reduced motion.
- `Folder`, `Stepper`, `PromptBar`, and `ThoughtLine` keep their source APIs.
  Configure them through props and semantic CSS variables. `Folder`'s `size` is
  a scale multiplier on a 224px base, not a pixel width.
- Decision flows are a real sequence, so numbered/connected steps are useful
  there; avoid decorative numbering elsewhere.
- The workspace frame carries one exit affordance: the back control in the
  sidebar header (desktop) and mobile header returns to the landing page.
- The library navigation uses live library data and 44px `SwipeRow` items.
  A swipe or the actions button reveals Rename and Delete; keep one row open,
  validate names, and confirm deletion. Drawer colors use sidebar/destructive
  tokens. Keyboard and reduced-motion reveals settle immediately, and normal
  taps retain link navigation. The navigation sheet and action dialogs skip
  spatial transitions under reduced motion.

## Uniqueness review

The first draft risked becoming a familiar “dark SaaS cards plus acid green”
layout. The revision keeps the screenshot palette but changes the structure:
one continuous analysis surface, a document-index rail, editorial typography,
and lime reserved for system state. This makes the product read as a document
reasoning workspace rather than a generic admin dashboard.
