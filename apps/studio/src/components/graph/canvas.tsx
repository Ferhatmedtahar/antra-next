import { IconArrowsMaximize, IconArrowsMinimize } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The frame both graph views draw into.
 *
 * The Render graph and the Route tree are different diagrams over the same
 * canvas, so everything about that canvas lives here once: its height, the
 * fullscreen swap, and the control that triggers it. Before this, the Render
 * graph had a fullscreen button and the Route tree silently did not, and the
 * two had drifted into separate copies of the same state and key handler.
 */
/**
 * `dvh` rather than `vh`, so a phone browser's retracting toolbar does not leave
 * the canvas a toolbar's height short of the screen. Under `sm` the chrome the
 * viewport is measured against is taller — the top bar, a header that has
 * wrapped, a filter row that has wrapped again — so the subtraction grows and the
 * floor drops with it.
 */
export const CANVAS =
  "h-[calc(100dvh-21rem)] min-h-[26rem] sm:h-[calc(100dvh-19rem)] sm:min-h-[520px]";

/**
 * Fullscreen replaces that fixed height with the viewport. Callers put this on
 * whichever element should take the screen — the canvas itself, or the row that
 * holds it and its side panel.
 */
export const CANVAS_FULLSCREEN = "bg-background fixed inset-0 z-50 p-4";

/** Fullscreen state plus its Escape hatch, shared so both views behave alike. */
export function useFullscreen(): {
  fullscreen: boolean;
  toggle: () => void;
} {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);
  return {
    fullscreen,
    toggle: () => setFullscreen((current) => !current),
  };
}

/**
 * Arrow-maximize rather than the corner-glyph maximize: at 16px the arrows read
 * as "this expands" where the corners read as a generic window control.
 */
export function FullscreenButton({
  fullscreen,
  onToggle,
}: {
  fullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="bg-surface-elevated/90 backdrop-blur"
      onClick={onToggle}
      aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
      title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
    >
      {fullscreen ? <IconArrowsMinimize /> : <IconArrowsMaximize />}
    </Button>
  );
}
