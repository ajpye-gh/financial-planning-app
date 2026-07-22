import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  tip: string;
  children: ReactNode;
}

const VIEWPORT_MARGIN = 8;

export function Tooltip({ tip, children }: Readonly<TooltipProps>) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
    <span
      ref={anchorRef}
      className="tooltip"
      tabIndex={0}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <span
            ref={bubbleRef}
            className="tooltip__bubble"
            role="tooltip"
            style={{ top: position.top, left: position.left }}
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  );
}
