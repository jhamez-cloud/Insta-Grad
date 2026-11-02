<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# InstaGrad frontend project guide

Last audited: 2026-11-01

This file is the canonical project inventory and implementation guide. Keep it
current whenever a skill, package, design token, font, or shared UI component
is added, removed, or materially changed.

## Hard rules

1. **Keep code clean and optimized, with complex animations and modern UIs
   while keeping resource usage efficient.** Complex animation means
   intentional, choreographed motion that improves comprehension or feedback,
   not constant decoration. Prefer compositor-friendly `transform` and
   `opacity`, avoid layout thrashing and unnecessary client-side JavaScript,
   and always support reduced-motion preferences.
2. **Use the project's installed fonts, design style, and semantic color
   tokens.** Do not introduce an unrelated font, raw brand color, or parallel
   theme system when an existing token or font role fits.
3. Read the relevant version-matched guide in `node_modules/next/dist/docs/`
   before changing Next.js code. This project runs Next.js 16.4 and may differ
   from older conventions.
4. Default to Server Components. Add `"use client"` only at the smallest
   interactive boundary that needs state, effects, events, or browser APIs.
5. Reuse and compose installed shadcn primitives before creating custom UI
   markup. Use semantic utilities such as `bg-primary`, `text-foreground`, and
   `border-border` instead of raw palette values.
6. Preserve accessibility: semantic HTML, keyboard operation, visible focus,
   sufficient contrast, labeled controls, and motion alternatives are required.

## Project snapshot

| Area | Current setup |
| --- | --- |
| Framework | Next.js `16.4.3`, App Router |
| UI runtime | React and React DOM `19.3.1` |
| Language | TypeScript `5.9.3`, strict mode |
| Styling | Tailwind CSS `4.3.3` through `@tailwindcss/postcss` |
| Component system | shadcn `4.23.0`, `radix-luma` style, Radix base |
| Icons | Lucide React `1.66.0` |
| Theme mode | `next-themes` with system default and class-based dark mode |
| Package manager | npm (`package-lock.json`) |
| Import alias | `@/*` maps to the repository root |
| Direction support | shadcn config has RTL support enabled |

## Design system

### Canonical theme

- The only global theme source is `app/globals.css`.
- The light `:root` and `.dark` blocks in that file contain the approved OKLCH
  tokens supplied by the project owner. Preserve those values unless the owner
  explicitly requests a palette change.
- The visual language is a clean neutral foundation with a vivid lime primary,
  cyan-to-blue chart scale, subtle neutral surfaces, and a base radius of
  `0.625rem`.
- Use the semantic roles already mapped through Tailwind: background,
  foreground, card, popover, primary, secondary, muted, accent, destructive,
  border, input, ring, chart, and sidebar.
- Light-mode Lightfall backgrounds use `ambient-primary` and
  `ambient-secondary` washes derived from the existing primary and chart-2
  tokens. These extra washes are transparent in dark mode.
- Do not apply a shadcn preset that overwrites fonts or CSS variables without
  explicit approval.

### Typography

Fonts are loaded from local package assets in `app/layout.tsx` through
`next/font/local`, so they are self-hosted and should not be replaced with
remote stylesheet imports.

| Role | Font | CSS variable / utility |
| --- | --- | --- |
| Primary editorial and current global face | Noto Serif | `--font-serif`, `font-serif`, `font-heading` |
| Sans-serif interface option | Geist | `--font-sans`, `font-sans` |
| Code, shortcuts, and technical data | Geist Mono | `--font-mono`, `font-mono` |

Use Noto Serif for the established brand voice, Geist for dense interface text
when a sans-serif improves clarity, and Geist Mono only for genuinely technical
content. Keep the number of font weights and styles loaded or rendered to the
minimum needed.

### Motion and visual quality

- Use the installed `tw-animate-css` utilities and the `animate` skill when
  motion is requested.
- Make sophisticated sequences purposeful: define the trigger, hierarchy,
  interruption behavior, and exit state.
- Prefer short transform/opacity transitions and shared timing tokens. Avoid
  animating expensive layout, filter, or large blurred layers without a measured
  need.
- Respect `prefers-reduced-motion`, avoid unnecessary infinite loops, and test
  animation on mobile-sized layouts and lower-powered devices.
- The prompt bar's liquid-metal rims come from `metal-fx`, including the source,
  model, effort, dictation, and send controls. Mount them only after
  hydration, because the package renders its supported and fallback markup
  differently on the server, and skip it entirely under reduced motion. Tune it
  through the `metal`, `metalPreset`, and `metalStrength` props on `PromptBar`
  instead of restyling the generated wrapper.
- Toolbar controls are 32px tall, or 36px on coarse pointers, with stronger metal
  on hover, focus, and active states. Preserve their stable focus shells.
- `PromptBarBeam` composes the installed `border-beam` package as a decorative
  overlay on the prompt surface. It uses the primary/chart tokens, runs while
  focused or active, and keeps a static edge at rest or under reduced motion.
  Toggle it with `PromptBar`'s `borderBeam` prop; never wrap the textarea in a
  state-dependent effect wrapper.
- Spend visual complexity on a clear focal interaction; keep surrounding layout
  disciplined, responsive, and readable.

## Installed shared UI

| Component | Location | Notes |
| --- | --- | --- |
| `Button` | `components/ui/button.tsx` | shadcn/Radix button with default, outline, secondary, ghost, destructive, and link variants; sizes from `xs` through `lg` plus icon sizes |
| `Dialog`, `AlertDialog` | `components/ui/{dialog,alert-dialog}.tsx` | Accessible rename and delete-confirmation dialogs with responsive widths, project font/radius roles, and reduced-motion support |
| `SwipeRow` | `components/SwipeRow.tsx` | Owner-supplied gesture row with a visible actions toggle, keyboard focus, and link-safe pointer capture; library rows use `fullSwipe={false}` and `dismiss: false` to reveal actions before changing data |
| Form and surface primitives | `components/ui/{card,input,textarea,field,badge,separator,progress,skeleton,empty,sheet}.tsx` | Installed shadcn primitives for dashboard surfaces, forms, feedback, empty states, and the mobile navigation sheet |
| Chat primitives | `components/ui/{message-scroller,message,bubble,attachment,marker,trace}.tsx` | Installed shadcn conversation primitives for accessible streamed chat composition |
| ReactBits interaction set | `components/ui/{Lightfall,ParticleText,ClickSpark,Folder,Stepper,ThoughtLine,PromptBar}.tsx` | Owner-supplied components; preserve their public APIs and configure through props only |
| `PromptBarBeam` | `components/ui/prompt-bar-beam.tsx` | Theme-aware `border-beam` overlay for the prompt surface; static resting/reduced-motion edge and activity-driven animation |
| `ThemeProvider` | `components/theme-provider.tsx` | Wraps `next-themes`, follows system theme, disables transition flashes, and provides the `d` keyboard shortcut outside typing targets |
| `cn` utility | `lib/utils.ts` | Re-exports the installed `cn` package for class composition |

When adding or removing a shared primitive, update this table in the same change.
Before adding a new shadcn component, inspect installed components, search the
configured registries, and use the npm runner (`npx shadcn@latest ...`).

## Installed project skills

Project skills live under `.agents/skills/` and are pinned in
`skills-lock.json`.

| Skill | Use it for |
| --- | --- |
| `animate` | Implementing deliberate UI motion, transitions, entrances, exits, and interaction feedback |
| `frontend-design` | Establishing or reshaping visual direction, typography, layout, and distinctive modern UI |
| `seo-aeo-best-practices` | Metadata, Open Graph, robots, sitemaps, JSON-LD, EEAT, and answer-engine readiness |
| `shadcn` | Inspecting, adding, composing, theming, updating, or debugging shadcn components |

Read a skill's complete `SKILL.md` before following it. Update this inventory
and `skills-lock.json` together when the installed skill set changes.

## Package inventory

### Runtime and UI packages

| Package | Installed | Purpose |
| --- | ---: | --- |
| `next` | `16.4.3` | App Router framework and build/runtime tooling |
| `react`, `react-dom` | `19.3.1` | UI runtime and DOM renderer |
| `shadcn` | `4.23.0` | Component registry CLI and Tailwind integration |
| `@shadcn/react` | `0.3.1` | Runtime primitives used by the installed message scroller |
| `radix-ui` | `1.8.1` | Accessible component primitives |
| `next-themes` | `0.4.6` | Light, dark, and system theme state |
| `geist` | `1.9.0` | Local Geist Sans and Geist Mono variable font assets |
| `@fontsource-variable/noto-serif` | `5.3.0` | Local Noto Serif variable font asset |
| `lucide-react` | `1.66.0` | Project icon library |
| `@hugeicons/react`, `@hugeicons/core-free-icons` | `1.1.10`, `4.4.0` | Prompt bar icon set |
| `motion` | `12.43.0` | Prompt bar glyph and progress animation |
| `thinking-orbs` | `0.3.2` | Thinking state orbs in the chat trace |
| `metal-fx` | `2.0.11` | WebGL liquid-metal rims on the prompt bar and its controls |
| `border-beam` | `1.4.1` | Traveling border highlight on the active prompt surface |
| `class-variance-authority` | `0.7.1` | Typed component variants |
| `cn` | `0.5.1` | Class-name composition utility |
| `tw-animate-css` | `1.4.0` | Tailwind-compatible animation utilities |

### Development packages

| Package | Installed | Purpose |
| --- | ---: | --- |
| `tailwindcss`, `@tailwindcss/postcss` | `4.3.3` | Utility CSS engine and PostCSS plugin |
| `typescript` | `5.9.3` | Type checking |
| `eslint`, `eslint-config-next` | `9.39.5`, `16.4.3` | Static analysis and Next.js rules |
| `prettier`, `prettier-plugin-tailwindcss` | `3.9.10`, `0.8.1` | Formatting and Tailwind class ordering |
| `@types/node` | `20.19.43` | Node.js types |
| `@types/react`, `@types/react-dom` | `19.3.0` | React type declarations |

Treat `package.json` and `package-lock.json` as the dependency source of truth.
Update these tables in the same change whenever dependencies change.

## Implementation conventions

- Keep global CSS limited to theme tokens, Tailwind/shadcn integration, and
  truly global base rules. Prefer Tailwind utilities for component styling and
  CSS Modules only when scoped CSS is clearer.
- Preserve predictable CSS import order; `app/globals.css` is imported once by
  the root layout.
- Use shadcn variants before one-off styling. Use `gap-*`, not `space-*`; use
  `size-*` when width and height match; use `cn()` for conditional classes.
- Use Lucide icons and follow the component's built-in icon sizing. Icons inside
  buttons use `data-icon="inline-start"` or `data-icon="inline-end"`.
- Keep client bundles lean: avoid unnecessary dependencies, dynamically load
  genuinely heavy client-only features, and do not move server-safe code into a
  client component.
- Build responsive behavior mobile-first and verify both light and dark themes.
- Keep copy in sentence case, concise, concrete, and consistent with the action
  it triggers.

## Useful commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run format
```

Run lint and typecheck for normal code changes. Run a production build when a
change affects routing, framework configuration, rendering boundaries, global
styles, or production behavior.
