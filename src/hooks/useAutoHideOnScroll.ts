import { useEffect, useRef, useState } from 'react';

interface AutoHideOptions {
  /** Scroll position (px) below which the element always stays visible - no point hiding it right
   *  near the top where there's nothing to gain back. */
  revealThreshold?: number;
  /** Minimum scroll delta (px) to count as an intentional direction change, filtering out
   *  sub-pixel/rubber-band jitter that would otherwise flicker the element. */
  directionThreshold?: number;
  /** How long the element stays visible after an upward scroll before auto-hiding again. */
  autoHideDelayMs?: number;
}

/** Hides on scroll-down (past revealThreshold), reveals on scroll-up, then auto-hides again after
 *  autoHideDelayMs of no further upward scroll - the "peek" pattern for chrome that eats scarce
 *  mobile vertical space (nav bars, toolbars) but should still be reachable on demand. */
export function useAutoHideOnScroll({
  revealThreshold = 24,
  directionThreshold = 6,
  autoHideDelayMs = 2000,
}: AutoHideOptions = {}): boolean {
  const [hidden, setHidden] = useState(false);
  // Position at the start of the current tracked gesture - only moves when we actually act on a
  // direction (hide/show), not on every scroll event. Smooth/inertial scrolling fires many events
  // with tiny deltas (often 1-3px each); resetting this on every event (as an earlier version did)
  // meant no single event ever crossed directionThreshold, so small continuous scrolling never
  // registered at all. Anchoring it only on real decisions lets those tiny deltas accumulate.
  const anchorY = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    anchorY.current = window.scrollY;

    const clearHideTimer = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    const handleScroll = () => {
      const currentY = window.scrollY;

      if (currentY <= revealThreshold) {
        clearHideTimer();
        setHidden(false);
        anchorY.current = currentY;
        return;
      }

      const delta = currentY - anchorY.current;
      if (delta > directionThreshold) {
        clearHideTimer();
        setHidden(true);
        anchorY.current = currentY;
      } else if (delta < -directionThreshold) {
        clearHideTimer();
        setHidden(false);
        anchorY.current = currentY;
        hideTimer.current = setTimeout(() => setHidden(true), autoHideDelayMs);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearHideTimer();
    };
  }, [revealThreshold, directionThreshold, autoHideDelayMs]);

  return hidden;
}
