import { useState, type ReactNode } from 'react';

interface CollapsibleChartProps {
  children: ReactNode;
}

/** Mobile-only collapse toggle for the sticky chart (see .app-shell__chart / .chart-collapse in
 *  index.css) - the chart docks at the bottom of the screen there, so hiding it trades that space
 *  back to whatever's scrolled above it. Desktop always shows children; the toggle itself is
 *  hidden via CSS rather than skipped here, same as ControlGroup's own collapse button. */
export function CollapsibleChart({ children }: Readonly<CollapsibleChartProps>) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {!collapsed && children}
      <button
        type="button"
        className="chart-collapse__toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        {collapsed ? 'Show Chart' : 'Hide Chart'}
      </button>
    </>
  );
}
