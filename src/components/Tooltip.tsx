import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  tip: ReactNode;
  children: ReactNode;
}

const VIEWPORT_MARGIN = 8;
const HIDE_DELAY_MS = 150;

export function Tooltip({ tip, children }: Readonly<TooltipProps>) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const show = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
    setVisible(true);
  };

  // Delayed rather than immediate - moving the pointer from the trigger down into the bubble
  // itself (e.g. to click a link inside its content, like baseFields.tsx's Social Security start
  // age tooltip) briefly leaves the trigger first; show() above cancels this if re-entered in time,
  // via either the trigger or the bubble.
  const scheduleHide = () => {
    hideTimeoutRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  };

  useLayoutEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) {
      return undefined;
    }

    const updatePosition = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      if (!anchorRect) {
        return;
      }
      setPosition({ top: anchorRect.bottom + 8, left: anchorRect.left + anchorRect.width / 2 });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible]);

  // Keep the bubble from running past the viewport's left/right edge.
  useLayoutEffect(() => {
    const bubbleRect = bubbleRef.current?.getBoundingClientRect();
    if (!bubbleRect) {
      return;
    }
    const halfWidth = bubbleRect.width / 2;
    const clampedLeft = Math.min(
      Math.max(position.left, VIEWPORT_MARGIN + halfWidth),
      window.innerWidth - VIEWPORT_MARGIN - halfWidth,
    );
    if (clampedLeft !== position.left) {
      setPosition((prev) => ({ ...prev, left: clampedLeft }));
    }
  }, [position]);

  return (
    <span ref={anchorRef} className="tooltip" tabIndex={0} onMouseEnter={show} onMouseLeave={scheduleHide} onFocus={show} onBlur={scheduleHide}>
      {children}
      {visible &&
        createPortal(
          <span
            ref={bubbleRef}
            className="tooltip__bubble"
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            onFocus={show}
            onBlur={scheduleHide}
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  );
}
