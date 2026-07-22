import type { ReactNode } from 'react';

interface TooltipProps {
  tip: string;
  children: ReactNode;
}

export function Tooltip({ tip, children }: Readonly<TooltipProps>) {
  return (
    <span className="tooltip" tabIndex={0}>
      {children}
      <span className="tooltip__bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
