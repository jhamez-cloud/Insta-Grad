"use client";

import { useSyncExternalStore } from "react";
import { BorderBeam } from "border-beam";

interface PromptBarBeamProps {
  active: boolean;
  busy?: boolean;
  radius?: number;
  theme: "light" | "dark";
}

function subscribeToMotion(onChange: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    preference.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function getMotionState() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  return document.hidden ? "hidden" : "visible";
}

const getServerMotionState = () => "pending";

// Keep the package's traveling border mask, using its documented CSS extension
// to match our palette and omit the interior wash over the prompt and controls.
const beamCss = `
[data-beam="{id}"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pb-ink, var(--foreground)) 12%, transparent);
}
[data-beam="{id}"][data-engaged] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 40%, var(--border));
}
[data-beam="{id}"][data-active] {
  animation-duration: 3.1s, 160ms;
  animation-timing-function: linear, var(--ease-out);
}
[data-beam="{id}"][data-fading] {
  animation-duration: 3.1s, 120ms;
  animation-timing-function: linear, var(--ease-out);
}
[data-beam="{id}"][data-active]::after,
[data-beam="{id}"][data-fading]::after {
  padding: 1.5px;
  background: linear-gradient(90deg, var(--primary), var(--chart-1) 55%, var(--chart-3));
  opacity: calc(var(--beam-opacity-{id}) * var(--beam-strength));
}
[data-beam="{id}"]::before,
[data-beam="{id}"] [data-beam-bloom] {
  display: none !important;
}
[data-beam="{id}"][data-document-hidden] {
  animation-play-state: paused !important;
}
@media (prefers-reduced-motion: reduce) {
  [data-beam="{id}"] {
    animation: none !important;
  }
  [data-beam="{id}"]::after {
    display: none !important;
  }
}
`;

/** Decorative overlay; place inside the prompt surface, without wrapping inputs. */
export function PromptBarBeam({ active, busy = false, radius = 16, theme }: PromptBarBeamProps) {
  const motionState = useSyncExternalStore(subscribeToMotion, getMotionState, getServerMotionState);
  // next-themes may already resolve dark on the first client render. Keep the
  // generated stylesheet identical to the server until hydration completes.
  const beamTheme = motionState === "pending" ? "light" : theme;

  return (
    <BorderBeam
      aria-hidden="true"
      data-prompt-beam=""
      data-theme={beamTheme}
      data-engaged={active ? "" : undefined}
      data-document-hidden={motionState === "hidden" ? "" : undefined}
      active={active && (motionState === "visible" || motionState === "hidden")}
      size="md"
      colorVariant="mono"
      staticColors
      theme={beamTheme}
      borderRadius={radius}
      duration={3.1}
      strength={busy ? 1 : 0.75}
      brightness={1}
      saturation={1}
      css={beamCss}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
    >
      {null}
    </BorderBeam>
  );
}
